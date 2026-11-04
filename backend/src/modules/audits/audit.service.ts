// Auditoria direta: o que o Booksy diz que foi vendido contra o que entrou na InfinitePay.
//
// A IDEIA
// O Booksy é a agenda: diz quanto foi prestado de serviço. O extrato da InfinitePay é a
// conta: diz quanto de dinheiro entrou. Em um mês fechado os dois têm de dar no mesmo
// número, e quando não dão existe um motivo concreto — serviço pago em espécie que não
// passou pela conta, tarifa retida antes do repasse, gorjeta que não é serviço. A
// auditoria obriga esse motivo a ser escrito antes de liberar os resultados.
//
// A EQUAÇÃO
//   faturamentoBooksy − entradasInfinitepay − ajusteManual = 0
//
// `ajusteManual` é assinado, e o sinal é a direção do lançamento:
//   faltou_entrar (+)  o Booksy registrou mais do que caiu na conta
//                      (pago em dinheiro, tarifa descontada antes do repasse)
//   entrou_a_mais (−)  caiu mais do que foi vendido
//                      (gorjeta, entrada que não é atendimento)
//
// POR QUE O FATURAMENTO É O LÍQUIDO
// Usamos bruto − descontos. O desconto do Booksy é cortesia: dinheiro que nunca foi
// cobrado do cliente e que, portanto, nunca ia entrar na conta. Comparar o bruto faria
// todo mês divergir exatamente pelo valor das cortesias — no arquivo real, R$ 360,00.
//
// POR QUE NADA DISSO É GRAVADO
// Os números saem dos lançamentos a cada leitura. Guardar a diferença significaria que o
// primeiro lançamento manual a tornaria falsa, e é justamente ela que precisa se mover
// quando a dona justifica a diferença.
import { Audit } from '../../models/audit.model.js';
import { Category } from '../../models/category.model.js';
import { Transaction, type AuditDirection, type AuditReason } from '../../models/transaction.model.js';
import { WITHDRAWAL_CATEGORY } from '../imports/infinitepay.parser.js';
import { AppError } from '../../shared/utils/app-error.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

/**
 * - `aprovada`      a diferença é zero (automático ou já justificado). Libera os resultados.
 * - `divergente`    as duas fontes têm dado no mês e os valores não fecham. Pede o motivo.
 * - `fonte_ausente` só uma das fontes tem dado no mês. **Não** pede motivo: o que falta é
 *                   o outro arquivo, e zerar isso com um ajuste seria falsear a auditoria.
 */
export type AuditOutcome = 'aprovada' | 'divergente' | 'fonte_ausente';

/** Diferença de até um centavo é arredondamento, não divergência. */
const TOLERANCE = 0.01;

/** Categoria única dos ajustes, com natureza "ambos" porque eles vão para os dois lados. */
export const ADJUSTMENT_CATEGORY = 'Ajustes de auditoria';

/**
 * O que cada motivo significa em dinheiro. `null` = não dá para deduzir, a dona informa.
 *
 * O caso que justifica a tabela existir é o `dinheiro`: o serviço pago em espécie JÁ está
 * no faturamento do Booksy, então ele explica por que o dinheiro não entrou na conta, mas
 * não é receita nova. Contá-lo no DRE faria o mês valer o dobro do atendimento.
 */
const REASON_EFFECTS: Record<AuditReason, {
  type: 'receita' | 'despesa' | null;
  countsInDre: boolean;
  direction: AuditDirection | null;
}> = {
  dinheiro: { type: 'receita', countsInDre: false, direction: 'faltou_entrar' },
  taxa: { type: 'despesa', countsInDre: true, direction: 'faltou_entrar' },
  gorjeta: { type: 'receita', countsInDre: true, direction: 'entrou_a_mais' },
  estorno: { type: 'despesa', countsInDre: true, direction: 'entrou_a_mais' },
  outro: { type: null, countsInDre: true, direction: null },
};

export interface AuditAdjustment {
  id: string;
  occurredAt: Date;
  description: string;
  amount: number;
  reason: AuditReason | null;
  direction: AuditDirection;
  /** Valor com sinal, como entra na equação. */
  signedAmount: number;
  countsInDre: boolean;
}

export interface AuditSummary {
  period: string;
  outcome: AuditOutcome;
  /** Faturamento líquido do Booksy no mês: bruto − descontos. */
  faturamentoBooksy: number;
  entradasInfinitepay: number;
  /** Soma assinada dos lançamentos manuais que participam da auditoria. */
  ajusteManual: number;
  /** faturamentoBooksy − entradasInfinitepay − ajusteManual. Zero = fechada. */
  diferenca: number;
  temBooksy: boolean;
  temInfinitepay: boolean;
  /** Qual arquivo falta, quando o desfecho é `fonte_ausente`. */
  fonteFaltante: 'booksy' | 'infinitepay' | 'ambas' | null;
  adjustments: AuditAdjustment[];
  /** Entradas consolidadas: o que de fato entrou, já explicado. */
  saldoBruto: number;
  /** O que a titular tirou da conta da InfinitePay no mês. */
  saldoRetirado: number;
  /** saldoBruto − saldoRetirado: o que ainda está na conta. */
  saldoLiquido: number;
  approvedAt: Date | null;
}

function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** 'AAAA-MM' -> o mês inteiro em UTC. Os lançamentos são gravados e filtrados em UTC. */
export function periodRange(period: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!match) {
    throw new AppError('Informe o mês no formato AAAA-MM.', 400, 'INVALID_PERIOD');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

/** O mês a que uma data pertence, em UTC. */
export function periodOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export class AuditService {
  /**
   * Estado da auditoria do mês, recalculado. É a única fonte dos números da tela de
   * Importar e dos três saldos do Painel — nada é somado no celular.
   */
  async getSummary(period: string): Promise<AuditSummary> {
    const range = periodRange(period);
    const common = {
      deletedAt: null,
      status: { $ne: 'cancelada' as const },
      occurredAt: { $gte: range.start, $lte: range.end },
    };

    const [booksy, infinitepay, manuais, retiradas, audit] = await Promise.all([
      Transaction.find({ ...common, origin: 'booksy', type: 'receita' })
        .select('grossAmount discountAmount')
        .lean(),
      Transaction.find({ ...common, origin: 'infinitepay', type: 'receita', countsInDre: { $ne: false } })
        .select('grossAmount')
        .lean(),
      // Só os manuais que carregam direção participam da comparação. Um aluguel lançado
      // à mão não tem nada a dizer sobre o que entrou na conta.
      Transaction.find({ ...common, origin: 'manual', auditDirection: { $exists: true } })
        .select('description grossAmount auditReason auditDirection countsInDre occurredAt')
        .sort({ occurredAt: 1 })
        .lean(),
      Transaction.find({ ...common, category: WITHDRAWAL_CATEGORY, countsInDre: false })
        .select('grossAmount')
        .lean(),
      Audit.findOne({ period }).lean(),
    ]);

    const faturamentoBooksy = roundCurrency(
      booksy.reduce((total, row) => total + row.grossAmount - row.discountAmount, 0),
    );
    const entradasInfinitepay = roundCurrency(
      infinitepay.reduce((total, row) => total + row.grossAmount, 0),
    );

    const adjustments: AuditAdjustment[] = manuais.map((row) => {
      const direction = row.auditDirection as AuditDirection;
      return {
        id: row._id.toString(),
        occurredAt: row.occurredAt,
        description: row.description,
        amount: roundCurrency(row.grossAmount),
        reason: row.auditReason ?? null,
        direction,
        signedAmount: roundCurrency(direction === 'faltou_entrar' ? row.grossAmount : -row.grossAmount),
        countsInDre: row.countsInDre,
      };
    });
    const ajusteManual = roundCurrency(
      adjustments.reduce((total, entry) => total + entry.signedAmount, 0),
    );

    const diferenca = roundCurrency(faturamentoBooksy - entradasInfinitepay - ajusteManual);
    const temBooksy = booksy.length > 0;
    const temInfinitepay = infinitepay.length > 0;

    const saldoRetirado = roundCurrency(retiradas.reduce((total, row) => total + row.grossAmount, 0));
    const saldoBruto = roundCurrency(entradasInfinitepay + ajusteManual);

    return {
      period,
      outcome: this.outcomeFor({ diferenca, temBooksy, temInfinitepay }),
      faturamentoBooksy,
      entradasInfinitepay,
      ajusteManual,
      diferenca,
      temBooksy,
      temInfinitepay,
      fonteFaltante: this.missingSource(temBooksy, temInfinitepay),
      adjustments,
      saldoBruto,
      saldoRetirado,
      saldoLiquido: roundCurrency(saldoBruto - saldoRetirado),
      approvedAt: audit?.approvedAt ?? null,
    };
  }

  /**
   * Ordem importa: a fonte ausente é verificada ANTES da diferença. Um mês com só o
   * extrato importado tem `diferenca` igual às entradas, e tratar isso como divergência
   * ofereceria à dona "justifique R$ 6.898,28" quando o que falta é o outro arquivo.
   *
   * O mês vazio (nenhuma das duas fontes) também cai aqui, e é o certo: nada a auditar
   * não é auditoria aprovada.
   */
  private outcomeFor(input: { diferenca: number; temBooksy: boolean; temInfinitepay: boolean }): AuditOutcome {
    if (!input.temBooksy || !input.temInfinitepay) return 'fonte_ausente';
    return Math.abs(input.diferenca) <= TOLERANCE ? 'aprovada' : 'divergente';
  }

  private missingSource(temBooksy: boolean, temInfinitepay: boolean): AuditSummary['fonteFaltante'] {
    if (temBooksy && temInfinitepay) return null;
    if (!temBooksy && !temInfinitepay) return 'ambas';
    return temBooksy ? 'infinitepay' : 'booksy';
  }

  /**
   * Registra a submissão do mês e carimba a aprovação quando a diferença chega a zero.
   * O carimbo é a trilha: ela não precisa apertar nada: fechar a conta É a aprovação,
   * tanto no Cenário A (os valores já batiam) quanto no C (o manual veio antes).
   */
  async register(
    period: string,
    batches: { booksyBatchId?: string; infinitepayBatchId?: string },
    actor: AuthenticatedUser,
  ): Promise<AuditSummary> {
    const summary = await this.getSummary(period);

    const audit = await Audit.findOneAndUpdate(
      { period },
      {
        $set: {
          faturamentoBooksy: summary.faturamentoBooksy,
          entradasInfinitepay: summary.entradasInfinitepay,
          ...(batches.booksyBatchId ? { booksyBatchId: batches.booksyBatchId } : {}),
          ...(batches.infinitepayBatchId ? { infinitepayBatchId: batches.infinitepayBatchId } : {}),
        },
        $setOnInsert: { period, createdBy: actor.id },
      },
      { new: true, upsert: true },
    );

    if (summary.outcome === 'aprovada' && !audit.approvedAt) {
      audit.approvedAt = new Date();
      audit.set('approvedBy', actor.id);
      await audit.save();
      return { ...summary, approvedAt: audit.approvedAt };
    }

    return summary;
  }

  /** Marca a aprovação de um mês que já estava fechado mas nunca foi carimbado. */
  async stampIfClosed(period: string, actor: AuthenticatedUser): Promise<AuditSummary> {
    return this.register(period, {}, actor);
  }

  /**
   * O Lançamento Manual que justifica a diferença.
   *
   * O motivo decide tudo — tipo, direção e efeito no DRE — para a dona não ter de escolher
   * sinal nem natureza contábil. Só "outro" pergunta, porque aí não há o que deduzir.
   */
  async addAdjustment(
    period: string,
    input: {
      amount: number;
      reason: AuditReason;
      description: string;
      direction?: AuditDirection | undefined;
      type?: 'receita' | 'despesa' | undefined;
      occurredAt?: Date | undefined;
    },
    actor: AuthenticatedUser,
  ): Promise<AuditSummary> {
    const range = periodRange(period);
    const effect = REASON_EFFECTS[input.reason];

    const direction = effect.direction ?? input.direction;
    if (!direction) {
      throw new AppError(
        'Para o motivo "outro", diga se faltou entrar ou se entrou a mais.',
        400,
        'DIRECTION_REQUIRED',
      );
    }
    const type = effect.type ?? input.type ?? 'receita';

    // Fechar a auditoria de outubro em novembro é normal. O ajuste tem de cair DENTRO do
    // mês auditado, senão ele não entra na conta que ele existe para fechar.
    const occurredAt = input.occurredAt ?? range.end;
    if (occurredAt < range.start || occurredAt > range.end) {
      throw new AppError(
        `A data do lançamento tem de estar dentro de ${period}.`,
        400,
        'DATE_OUT_OF_PERIOD',
      );
    }

    await this.ensureAdjustmentCategory();

    await Transaction.create({
      type,
      description: input.description,
      grossAmount: input.amount,
      discountAmount: 0,
      feeAmount: 0,
      commissionAmount: 0,
      studioNetProfit: type === 'receita' ? input.amount : -input.amount,
      netAmount: input.amount,
      category: ADJUSTMENT_CATEGORY,
      ...(type === 'despesa' ? { costType: 'variavel' as const } : {}),
      paymentMethod: input.reason === 'dinheiro' ? 'dinheiro' : 'nao_informado',
      occurredAt,
      settledAt: occurredAt,
      status: 'liquidada',
      origin: 'manual',
      countsInDre: effect.countsInDre,
      auditReason: input.reason,
      auditDirection: direction,
      createdBy: actor.id,
    });

    // Recalcula e, se fechou, carimba. Zerar a conta É a aprovação.
    return this.register(period, {}, actor);
  }

  /** O catálogo é gerenciado pela dona; a categoria dos ajustes nasce sozinha. */
  private async ensureAdjustmentCategory(): Promise<void> {
    await Category.findOneAndUpdate(
      { name: ADJUSTMENT_CATEGORY },
      { $setOnInsert: { name: ADJUSTMENT_CATEGORY, kind: 'ambos', active: true, deletedAt: null } },
      { upsert: true },
    ).collation({ locale: 'pt', strength: 2 });
  }
}
