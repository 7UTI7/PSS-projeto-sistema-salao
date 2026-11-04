// Conciliação Booksy × InfinitePay: compara o que foi vendido com o que caiu na conta.
//
// A conciliação é AGREGADA por período, não linha a linha, e isso é consequência do que o
// extrato da InfinitePay realmente informa:
//
//   1. O extrato não tem coluna de taxa. O repasse da maquininha aparece como um
//      "Depósito de vendas" já líquido de tarifa, então a taxa não é lida: é deduzida da
//      diferença entre o que o Booksy registrou como venda e o que entrou na conta.
//   2. Esse repasse é um lote diário, não uma linha por venda. Não existe a venda
//      individual do lado do extrato para casar com o atendimento do Booksy.
//   3. O relatório do Booksy não informa a forma de pagamento, então nem por aí daria para
//      separar o que foi cartão, Pix ou dinheiro.
//
// Por isso nenhuma transação é marcada como conciliada: no agregado não há par individual a
// marcar, e marcar por aproximação seria inventar um vínculo que o arquivo não dá.
//
// A diferença apurada ("taxas") é, na verdade, taxa da maquininha + pagamentos em dinheiro
// que nunca passam pela conta + vendas liquidadas em outro mês. É por isso que ela aparece
// na tela como valor derivado, e não como "a taxa que a InfinitePay cobrou".
import { Transaction } from '../../models/transaction.model.js';
import { CARD_SALES_CATEGORY, PIX_INCOME_CATEGORY } from '../imports/infinitepay.parser.js';
import type { DateRange } from './report.service.js';

export type DivergenceKind =
  | 'sem_booksy'
  | 'sem_infinitepay'
  | 'recebido_acima_do_vendido'
  | 'entrada_fora_de_venda'
  | 'residuo';

export interface ReconciliationDivergence {
  tipo: DivergenceKind;
  descricao: string;
  valor: number;
}

export interface ReconciliationSummary {
  /** Soma dos atendimentos do Booksy no período, antes do desconto. */
  vendasBrutas: number;
  descontos: number;
  /** Bruto menos desconto: é o que deveria ter virado dinheiro. */
  vendasLiquidas: number;
  qtdServicos: number;
  recebidoPix: number;
  recebidoCartao: number;
  /** Entradas do extrato que não são venda (estorno, aporte, transferência). */
  outrasEntradas: number;
  /** Pix recebido + repasses da maquininha: o que entrou por venda. */
  liquidoReceber: number;
  /** Derivado (vendido menos recebido). `null` quando falta uma das duas origens. */
  taxas: number | null;
  /** Fração, não percentual (0.1003 = 10,03%). `null` pelos mesmos motivos. */
  taxaMediaEfetiva: number | null;
  divergencias: ReconciliationDivergence[];
  totalDivergencias: number;
}

interface DivergenceInput {
  hasSales: boolean;
  hasReceived: boolean;
  vendasLiquidas: number;
  liquidoReceber: number;
  outrasEntradas: number;
  taxas: number | null;
}

function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export class ReconciliationService {
  async getSummary(range: DateRange): Promise<ReconciliationSummary> {
    const period = { $gte: range.start, $lte: range.end };

    const [sales, received] = await Promise.all([
      Transaction.find({
        deletedAt: null,
        origin: 'booksy',
        type: 'receita',
        status: { $ne: 'cancelada' },
        occurredAt: period,
      })
        .select('grossAmount discountAmount')
        .lean(),
      Transaction.find({
        deletedAt: null,
        origin: 'infinitepay',
        type: 'receita',
        status: { $ne: 'cancelada' },
        occurredAt: period,
      })
        .select('grossAmount category')
        .lean(),
    ]);

    const vendasBrutas = roundCurrency(sales.reduce((total, row) => total + row.grossAmount, 0));
    const descontos = roundCurrency(sales.reduce((total, row) => total + row.discountAmount, 0));
    const vendasLiquidas = roundCurrency(vendasBrutas - descontos);

    const sumWhere = (match: (category: string) => boolean): number =>
      roundCurrency(
        received.filter((row) => match(row.category)).reduce((total, row) => total + row.grossAmount, 0),
      );

    const recebidoPix = sumWhere((category) => category === PIX_INCOME_CATEGORY);
    const recebidoCartao = sumWhere((category) => category === CARD_SALES_CATEGORY);
    const outrasEntradas = sumWhere(
      (category) => category !== PIX_INCOME_CATEGORY && category !== CARD_SALES_CATEGORY,
    );
    const liquidoReceber = roundCurrency(recebidoPix + recebidoCartao);

    const hasSales = sales.length > 0;
    const hasReceived = received.length > 0;
    // Sem as duas pontas a subtração não significa nada: devolve null em vez de apresentar
    // o total de um lado só como se fosse a taxa.
    const bothSides = hasSales && hasReceived;

    const taxas = bothSides ? roundCurrency(vendasLiquidas - liquidoReceber) : null;
    const taxaMediaEfetiva =
      taxas !== null && vendasLiquidas > 0
        ? Math.round((taxas / vendasLiquidas) * 10_000) / 10_000
        : null;

    const divergencias = this.findDivergences({
      hasSales,
      hasReceived,
      vendasLiquidas,
      liquidoReceber,
      outrasEntradas,
      taxas,
    });

    return {
      vendasBrutas,
      descontos,
      vendasLiquidas,
      qtdServicos: sales.length,
      recebidoPix,
      recebidoCartao,
      outrasEntradas,
      liquidoReceber,
      taxas,
      taxaMediaEfetiva,
      divergencias,
      totalDivergencias: roundCurrency(
        divergencias.reduce((total, item) => total + Math.abs(item.valor), 0),
      ),
    };
  }

  /**
   * Cada divergência é uma verificação explícita, com o valor que está em jogo. Um período
   * vazio nas duas origens não gera divergência nenhuma: não é inconsistência, é só um mês
   * sem importação.
   */
  private findDivergences(input: DivergenceInput): ReconciliationDivergence[] {
    const divergencias: ReconciliationDivergence[] = [];

    if (input.hasReceived && !input.hasSales) {
      divergencias.push({
        tipo: 'sem_booksy',
        descricao:
          'Entrou dinheiro na conta neste período, mas não há atendimento do Booksy neste '
          + 'mês para comparar. Confira em "Períodos importados" de que mês é cada '
          + 'arquivo: pode ser só o mês selecionado que está fora do relatório.',
        valor: input.liquidoReceber,
      });
    }

    if (input.hasSales && !input.hasReceived) {
      divergencias.push({
        tipo: 'sem_infinitepay',
        descricao:
          'Há atendimentos do Booksy neste período, mas nenhum movimento da InfinitePay '
          + 'neste mês. Confira em "Períodos importados" de que mês é cada arquivo: pode '
          + 'ser só o mês selecionado que está fora do extrato.',
        valor: input.vendasLiquidas,
      });
    }

    if (input.outrasEntradas > 0) {
      divergencias.push({
        tipo: 'entrada_fora_de_venda',
        descricao:
          'Entradas no extrato que não são venda (estorno, aporte ou transferência). Não '
          + 'entram na comparação com o Booksy.',
        valor: input.outrasEntradas,
      });
    }

    if (input.taxas !== null && input.taxas < 0) {
      divergencias.push({
        tipo: 'recebido_acima_do_vendido',
        descricao:
          'Entrou mais dinheiro do que foi vendido no período. Em geral é repasse de vendas '
          + 'do mês anterior caindo agora, ou os dois arquivos cobrindo períodos diferentes.',
        valor: Math.abs(input.taxas),
      });
    }

    if (input.taxas !== null && input.taxas > 0) {
      divergencias.push({
        tipo: 'residuo',
        descricao:
          'Diferença entre o que foi vendido e o que caiu na conta: taxa da maquininha, '
          + 'pagamentos em dinheiro que não passam pela conta e vendas que só serão '
          + 'repassadas no mês seguinte.',
        valor: input.taxas,
      });
    }

    return divergencias;
  }
}
