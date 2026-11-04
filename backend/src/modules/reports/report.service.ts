// Resumo financeiro do período e Fluxo de Caixa.
//
// `getFinancialSummary` é a ÚNICA fonte dos números do mês. O Painel e a tela de
// Lançamentos consomem os dois o mesmo objeto, para que não exista mais uma conta no
// servidor e outra somada no celular — era daí que vinha faturamento R$ 180,00 no Painel
// e R$ 220,00 em Lançamentos para o mesmo mês.
//
// Regimes (é o que decide qual data cada número usa):
//   competência -> faturamento, descontos, taxas, comissões e despesas, pela data do fato
//                  (`occurredAt`). É o resultado do mês, tenha o dinheiro entrado ou não.
//   caixa       -> `saldo`, só o que foi liquidado, pela data da liquidação (`settledAt`).
//
// FATURAMENTO NÃO INCLUI O EXTRATO, e esta é a regra mais importante do arquivo.
//
// O Booksy registra a venda; o extrato da InfinitePay registra o recebimento da MESMA
// venda. Somar as duas origens conta o mesmo dinheiro duas vezes. Antes isso era só um
// risco, porque a dona podia importar uma origem só; agora a auditoria exige os dois
// arquivos do mesmo mês, então o dobro seria garantido — o Painel mostraria R$ 940,00
// num mês de R$ 500,00 atendidos.
//
// Então: o faturamento vem do Booksy e dos lançamentos manuais. O que entrou na conta é
// assunto dos três saldos da auditoria (modules/audits/audit.service.ts), que é também
// quem confronta um lado com o outro.
//
// As DESPESAS continuam somando qualquer origem, extrato incluído: um Pix enviado a
// terceiro é dinheiro que saiu de verdade, e não tem contrapartida no Booksy.
//
// Linhas com `countsInDre: false` ficam fora dos dois regimes: são as retiradas da
// titular e os ajustes de auditoria cujo valor já está no faturamento do Booksy. Elas
// aparecem nos três saldos (getBalances), que é onde fazem sentido.
import { Transaction } from '../../models/transaction.model.js';
import { AppError } from '../../shared/utils/app-error.js';

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Os oito números do mês. Cada definição está no comentário e é a mesma em toda tela.
 * Comissão é repasse à profissional e fica em LINHA PRÓPRIA: somá-la às despesas fazia o
 * Painel mostrar "Despesas R$ 63,00" para um mês sem nenhuma despesa lançada.
 */
export interface FinancialSummary {
  /** Soma do valor bruto das receitas não canceladas. */
  faturamentoBruto: number;
  /** Descontos concedidos nessas receitas. */
  descontos: number;
  /** Taxas de meio de pagamento retidas nessas receitas. */
  taxas: number;
  /** faturamentoBruto − descontos − taxas. */
  receitaLiquida: number;
  /** Repasse às profissionais. Não é despesa do estúdio. */
  comissoes: number;
  /** Apenas lançamentos do tipo despesa, pelo valor bruto. */
  despesas: number;
  /** receitaLiquida − comissoes − despesas. */
  lucroEstudio: number;
  /** Regime de caixa: entradas liquidadas menos saídas liquidadas no período. */
  saldo: number;
}

function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export class ReportService {
  async getFinancialSummary(range: DateRange): Promise<FinancialSummary> {
    const [accrual, settled] = await Promise.all([
      // Competência: o fato aconteceu no período, independente do pagamento.
      Transaction.find({
        deletedAt: null,
        countsInDre: { $ne: false },
        status: { $ne: 'cancelada' },
        occurredAt: { $gte: range.start, $lte: range.end },
        // Receita do extrato fica fora (é a mesma venda do Booksy, vista como caixa);
        // despesa do extrato entra.
        $or: [{ type: 'despesa' }, { origin: { $ne: 'infinitepay' } }],
      })
        .select('type grossAmount discountAmount feeAmount commissionAmount')
        .lean(),
      // Caixa: o dinheiro entrou ou saiu no período.
      Transaction.find({
        deletedAt: null,
        countsInDre: { $ne: false },
        status: 'liquidada',
        settledAt: { $gte: range.start, $lte: range.end },
      })
        .select('type netAmount')
        .lean(),
    ]);

    let faturamentoBruto = 0;
    let descontos = 0;
    let taxas = 0;
    let comissoes = 0;
    let despesas = 0;

    for (const entry of accrual) {
      if (entry.type === 'receita') {
        faturamentoBruto += entry.grossAmount;
        descontos += entry.discountAmount;
        taxas += entry.feeAmount;
        comissoes += entry.commissionAmount;
      } else {
        despesas += entry.grossAmount;
      }
    }

    let saldo = 0;
    for (const entry of settled) {
      saldo += entry.type === 'receita' ? entry.netAmount : -entry.netAmount;
    }

    faturamentoBruto = roundCurrency(faturamentoBruto);
    descontos = roundCurrency(descontos);
    taxas = roundCurrency(taxas);
    comissoes = roundCurrency(comissoes);
    despesas = roundCurrency(despesas);

    const receitaLiquida = roundCurrency(faturamentoBruto - descontos - taxas);

    return {
      faturamentoBruto,
      descontos,
      taxas,
      receitaLiquida,
      comissoes,
      despesas,
      lucroEstudio: roundCurrency(receitaLiquida - comissoes - despesas),
      saldo: roundCurrency(saldo),
    };
  }

  async getCashFlow(range: DateRange): Promise<{ date: string; amount: number }[]> {
    const entries = await Transaction.find({
      deletedAt: null,
      countsInDre: { $ne: false },
      settledAt: { $gte: range.start, $lte: range.end },
      status: 'liquidada',
    }).sort({ settledAt: 1 }).lean();
    const daily = new Map<string, number>();

    for (const entry of entries) {
      if (!entry.settledAt) continue;
      const date = entry.settledAt.toISOString().slice(0, 10);
      const sign = entry.type === 'receita' ? 1 : -1;
      daily.set(date, (daily.get(date) ?? 0) + sign * entry.netAmount);
    }

    return [...daily.entries()].map(([date, amount]) => ({
      date,
      amount: roundCurrency(amount),
    }));
  }

  validateRange(start: string, end: string): DateRange {
    const range = { start: new Date(start), end: new Date(end) };
    if (Number.isNaN(range.start.getTime()) || Number.isNaN(range.end.getTime()) || range.start > range.end) {
      throw new AppError('Período inválido.', 400, 'INVALID_DATE_RANGE');
    }
    return range;
  }
}
