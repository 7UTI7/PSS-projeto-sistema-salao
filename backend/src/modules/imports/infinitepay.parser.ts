// Converte o "Relatório de movimentações" da InfinitePay em lançamentos de caixa.
//
// O QUE ESTE RELATÓRIO É
// Um extrato da conta (InfinitePay/CloudWalk), não um relatório de vendas. Colunas:
//   Data | Hora | Tipo de transação | Nome | Detalhe | Valor (R$)
// e três tipos de movimento no arquivo real:
//   Pix / Recebido              -> cliente pagou por Pix direto na conta
//   Pix / Enviado               -> saiu dinheiro da conta
//   Depósito de vendas / ...    -> repasse das vendas na maquininha, JÁ LÍQUIDO de tarifa
//
// DUAS CONSEQUÊNCIAS IMPORTANTES
//
// 1. Não dá para extrair a taxa da maquininha daqui. O extrato mostra só o valor repassado,
//    nunca o bruto da venda, então a tarifa não aparece em nenhuma coluna — ela já está
//    descontada. O efeito dela no resultado é a receita entrar menor, e não uma despesa.
//
// 2. Transferência para a própria titular não é despesa. No arquivo real, todas as saídas
//    são Pix para "Nicolle Neris Rodrigues", que é a titular da conta: é ela tirando da
//    conta do salão para a conta pessoal. Lançar isso como despesa faria o DRE mostrar
//    resultado perto de zero todo mês, porque ela retira quase tudo o que entra. Então
//    esses movimentos são somados e informados à parte (ver AsideTotal), não lançados.
//    Pix enviado para terceiros, aí sim, é despesa.
//
// CUIDADO COM DUPLICIDADE EM RELAÇÃO AO BOOKSY
// O Booksy diz o que foi vendido; este extrato diz o dinheiro que entrou. É em boa parte o
// mesmo dinheiro visto em dois momentos. Importar as duas origens para um mês que se
// sobrepõe dobra o faturamento — quem avisa é o ImportService, comparando os períodos.
import { AppError } from '../../shared/utils/app-error.js';
import type { PaymentMethod, Professional, TransactionType } from '../../models/transaction.model.js';
import type {
  AsideTotal,
  ParseOptions,
  ParseOutcome,
  ParsedRow,
  SheetTable,
  SkippedRow,
} from './import.types.js';
import { normalizeHeader, parseAmount } from './spreadsheet.reader.js';

/** Categorias criadas por esta origem, separadas por natureza do movimento. */
export const PIX_INCOME_CATEGORY = 'Recebimentos Pix';
export const CARD_SALES_CATEGORY = 'Vendas na maquininha';
export const PIX_EXPENSE_CATEGORY = 'Pagamentos Pix';
export const OTHER_INCOME_CATEGORY = 'Outras entradas';
export const OTHER_EXPENSE_CATEGORY = 'Outras saídas';

/**
 * O extrato é da conta do salão e não informa quem atendeu, então o lançamento fica com a
 * titular. A atribuição por profissional — e portanto a comissão — vem do Booksy.
 */
const ACCOUNT_OWNER: Professional = 'Nicolle';

const MONTHS: ReadonlyMap<string, number> = new Map([
  ['jan', 0], ['fev', 1], ['mar', 2], ['abr', 3], ['mai', 4], ['jun', 5],
  ['jul', 6], ['ago', 7], ['set', 8], ['out', 9], ['nov', 10], ['dez', 11],
]);

/** Linhas de estrutura do documento: cabeçalho de página, cabeçalho de coluna e rodapé. */
const NOISE = [
  'relatorio de movimentacoes',
  'data',
  'hora',
  'tipo de transacao',
  'nome',
  'detalhe',
  'saldo do dia',
  'valor em r',
  'saldo inicial',
  'total de entradas',
  'total de saidas',
  'saldo final do periodo',
  'a central de ajuda esta disponivel',
  'pagina',
  'cloudwalk',
];

interface Movement {
  line: number;
  page: string;
  occurredAt: Date;
  /** Texto da coluna "Tipo de transação". */
  kind: string;
  /** Texto da coluna "Nome" (contraparte do movimento). */
  counterparty: string;
  /** Texto da coluna "Detalhe". */
  detail: string;
  /** Positivo para entrada, negativo para saída. */
  amount: number;
}

/** Totais que o próprio extrato declara, usados para conferir a leitura. */
interface StatementSummary {
  totalIn: number | null;
  totalOut: number | null;
  openingBalance: number | null;
  closingBalance: number | null;
  accountHolder: string | null;
}

export function parseInfinitePayStatement(tables: SheetTable[], options: ParseOptions): ParseOutcome {
  void options; // A comissão não se aplica: o extrato não diz quem atendeu.

  const summary = readSummary(tables);
  const { movements, skipped } = readMovements(tables);

  if (movements.length === 0) {
    throw new AppError(
      'Não encontrei movimentações neste PDF. Confira se é o "Relatório de movimentações" '
        + 'da InfinitePay, exportado pelo aplicativo.',
      400,
      'STATEMENT_WITHOUT_MOVEMENTS',
    );
  }

  reconcile(movements, summary);

  const rows: ParsedRow[] = [];
  const transfers: Movement[] = [];
  const used = new Map<string, number>();

  for (const movement of movements) {
    if (isOwnTransfer(movement, summary.accountHolder)) {
      transfers.push(movement);
      continue;
    }
    rows.push(toParsedRow(movement, used));
  }

  const asides: AsideTotal[] = [];
  if (transfers.length > 0) {
    asides.push({
      label: 'Transferências entre contas da titular',
      count: transfers.length,
      amount: round(transfers.reduce((total, movement) => total + movement.amount, 0)),
      reason: 'Movimento entre contas da mesma pessoa, não é receita nem despesa do salão. '
        + 'Não foi lançado para não distorcer o resultado.',
    });
  }

  return { rows, skipped, asides };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * O bloco de resumo da primeira página traz os totais do período e o titular da conta.
 * Cada um está em uma linha do tipo "Total de entradas | + 6.938,28".
 */
function readSummary(tables: SheetTable[]): StatementSummary {
  const summary: StatementSummary = {
    totalIn: null,
    totalOut: null,
    openingBalance: null,
    closingBalance: null,
    accountHolder: null,
  };

  for (const table of tables) {
    for (const row of table.rows) {
      for (let index = 0; index < row.length; index += 1) {
        const label = normalizeHeader(row[index] ?? '');
        const value = signedAmount(row[index + 1] ?? '');

        if (summary.accountHolder === null) {
          const holder = accountHolder(row[index] ?? '');
          if (holder) summary.accountHolder = holder;
        }

        if (value === null) continue;
        if (label === 'total de entradas') summary.totalIn ??= value;
        else if (label === 'total de saidas') summary.totalOut ??= value;
        else if (label === 'saldo inicial') summary.openingBalance ??= value;
        else if (label === 'saldo final do periodo') summary.closingBalance ??= value;
      }
    }
  }

  return summary;
}

/** Extrai o nome do titular de "60.441.829 NICOLLE NERIS RODRIGUES - CNPJ: 60.441.829/0001-51". */
function accountHolder(text: string): string | null {
  const match = /^[\d.\s/-]*?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\s]{4,})\s+-\s+(?:CNPJ|CPF)\b/.exec(text.trim());
  return match?.[1]?.trim() ?? null;
}

function readMovements(tables: SheetTable[]): { movements: Movement[]; skipped: SkippedRow[] } {
  const movements: Movement[] = [];
  const skipped: SkippedRow[] = [];
  let line = 0;

  for (const table of tables) {
    // A data aparece só na primeira linha de cada dia; as seguintes herdam a do dia.
    // O extrato repete a data ao virar a página, então não há risco de arrastar a data
    // de uma página para a outra por engano.
    let currentDay: { year: number; month: number; day: number } | null = null;

    for (const original of table.rows) {
      line += 1;
      // O leitor de PDF já entrega só as células com conteúdo, mas um CSV do mesmo extrato
      // traz as vazias (a data aparece uma vez por dia). Descartá-las aqui faz os dois
      // formatos chegarem na mesma forma, e é por isso que as colunas são lidas pela
      // posição relativa — hora primeiro, valor por último — e não pelo índice absoluto.
      let cells = compact(original);
      if (cells.length === 0 || isNoise(cells)) continue;

      const day = parseDay(cells[0] ?? '');
      if (day) {
        currentDay = day;
        cells = cells.slice(1);
      }

      const time = /^(\d{1,2}):(\d{2})$/.exec((cells[0] ?? '').trim());
      if (!time) continue; // Linha de resumo, cabeçalho repetido ou rodapé.
      if (!currentDay) {
        skipped.push({ line, reason: `${table.name}: movimento às ${cells[0]} sem a data do dia.` });
        continue;
      }

      const amount = signedAmount(cells[cells.length - 1] ?? '');
      if (amount === null) {
        skipped.push({ line, reason: `${table.name}: não consegui ler o valor do movimento às ${cells[0]}.` });
        continue;
      }

      const middle = cells.slice(1, -1);
      movements.push({
        line,
        page: table.name,
        occurredAt: new Date(Date.UTC(
          currentDay.year,
          currentDay.month,
          currentDay.day,
          Number(time[1]),
          Number(time[2]),
        )),
        kind: middle[0] ?? '',
        counterparty: middle.length >= 3 ? middle.slice(1, -1).join(' ') : '',
        detail: middle.length >= 2 ? (middle[middle.length - 1] ?? '') : '',
        amount,
      });
    }
  }

  return { movements, skipped };
}

function compact(cells: readonly string[]): string[] {
  return cells.map((cell) => cell.trim()).filter((cell) => cell !== '');
}

function isNoise(cells: readonly string[]): boolean {
  const first = normalizeHeader(cells[0] ?? '');
  if (first === '') return true;
  // "Data" e "Hora" só são ruído quando a linha é mesmo o cabeçalho de colunas.
  if (first === 'data') return normalizeHeader(cells[1] ?? '') === 'hora';
  return NOISE.some((noise) => first.startsWith(noise)) && !/^\d{2}\s/.test((cells[0] ?? '').trim());
}

/** "01 Out, 2026" -> componentes da data. */
function parseDay(text: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{1,2})\s*(?:de\s+)?([A-Za-zÀ-ÿ]{3,})\.?,?\s*(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const month = MONTHS.get(normalizeHeader(match[2] ?? '').slice(0, 3));
  if (month === undefined) return null;
  return { year: Number(match[3]), month, day: Number(match[1]) };
}

/**
 * No extrato o sinal é a informação principal: "+40,00" entrou, "-200,00" saiu. Exigir o
 * sinal explícito também é o que distingue uma célula de valor de uma célula de texto.
 */
function signedAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[+-]\s*[\d.,]+$/.test(trimmed)) return null;
  const value = parseAmount(trimmed.replace(/^[+-]\s*/, ''));
  if (value === null) return null;
  return trimmed.startsWith('-') ? -Math.abs(value) : Math.abs(value);
}

// ---------------------------------------------------------------------------
// Conferência com os totais do próprio extrato
// ---------------------------------------------------------------------------

/**
 * O extrato declara os próprios totais, então a leitura pode ser provada em vez de
 * presumida. Se as somas não fecharem, alguma linha foi lida errado ou ficou de fora —
 * e importar um extrato lido pela metade é pior do que não importar.
 */
function reconcile(movements: readonly Movement[], summary: StatementSummary): void {
  const credits = round(movements.filter((m) => m.amount > 0).reduce((total, m) => total + m.amount, 0));
  const debits = round(movements.filter((m) => m.amount < 0).reduce((total, m) => total + m.amount, 0));

  const checks: Array<{ label: string; declared: number | null; computed: number }> = [
    { label: 'Total de entradas', declared: summary.totalIn, computed: credits },
    { label: 'Total de saídas', declared: summary.totalOut, computed: debits },
  ];

  for (const check of checks) {
    if (check.declared === null) continue;
    if (Math.abs(check.declared - check.computed) <= 0.01) continue;
    throw new AppError(
      `A leitura do extrato não fecha com os totais do próprio documento: `
        + `"${check.label}" é ${money(check.declared)} no relatório, mas as linhas somam `
        + `${money(check.computed)}. Envie o PDF original, sem alterações, ou avise o suporte.`,
      400,
      'STATEMENT_TOTALS_MISMATCH',
    );
  }

  if (summary.openingBalance !== null && summary.closingBalance !== null) {
    const expected = round(summary.openingBalance + credits + debits);
    if (Math.abs(expected - summary.closingBalance) > 0.01) {
      throw new AppError(
        `O saldo do extrato não fecha: ${money(summary.openingBalance)} de saldo inicial mais as `
          + `movimentações dão ${money(expected)}, mas o relatório informa `
          + `${money(summary.closingBalance)} de saldo final.`,
        400,
        'STATEMENT_TOTALS_MISMATCH',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Classificação
// ---------------------------------------------------------------------------

/** Movimento cuja contraparte é a própria titular: troca de bolso, não resultado. */
function isOwnTransfer(movement: Movement, accountHolderName: string | null): boolean {
  if (!accountHolderName) return false;
  const holder = normalizeHeader(accountHolderName);
  const counterparty = normalizeHeader(movement.counterparty);
  if (!holder || !counterparty) return false;
  // A contraparte vem como "Pix Nicolle Neris Rodrigues"; o titular, como "NICOLLE NERIS RODRIGUES".
  return counterparty.includes(holder);
}

function toParsedRow(movement: Movement, used: Map<string, number>): ParsedRow {
  const income = movement.amount > 0;
  const type: TransactionType = income ? 'receita' : 'despesa';
  const kind = normalizeHeader(movement.kind);
  const isCardDeposit = kind.includes('deposito');
  const isPix = kind.includes('pix');

  const paymentMethod: PaymentMethod = isCardDeposit ? 'credito' : isPix ? 'pix' : 'nao_informado';
  const category = isCardDeposit
    ? CARD_SALES_CATEGORY
    : isPix
      ? (income ? PIX_INCOME_CATEGORY : PIX_EXPENSE_CATEGORY)
      : (income ? OTHER_INCOME_CATEGORY : OTHER_EXPENSE_CATEGORY);

  return {
    externalId: uniqueId(movement, used),
    type,
    description: describe(movement, isCardDeposit),
    category,
    professional: ACCOUNT_OWNER,
    grossAmount: Math.abs(movement.amount),
    discountAmount: 0,
    // O repasse da maquininha já vem líquido e o Pix não tem tarifa: não há taxa a aplicar.
    paymentFeeRate: 0,
    // Sem informação de quem atendeu, não há base para comissão (ela vem do Booksy).
    professionalCommissionRate: 0,
    paymentMethod,
    occurredAt: movement.occurredAt,
    // Extrato é dinheiro que já entrou ou saiu da conta: liquidado na data do movimento.
    settledAt: movement.occurredAt,
    status: 'liquidada',
  };
}

function describe(movement: Movement, isCardDeposit: boolean): string {
  if (isCardDeposit) return 'Depósito InfinitePay (vendas na maquininha)';

  // "Pix ANABELLE C CASARINI SILVA" -> "ANABELLE C CASARINI SILVA"
  const name = movement.counterparty.replace(/^pix\s+/i, '').trim();
  const action = movement.detail.trim() || (movement.amount > 0 ? 'Recebido' : 'Enviado');
  const label = `${movement.kind.trim() || 'Movimento'} ${action.toLowerCase()}`;
  return name ? `${label} — ${name}` : label;
}

/**
 * O extrato não traz identificador de transação, então a chave é a própria linha: data, hora,
 * valor e contraparte. Quando duas linhas iguais acontecem no mesmo minuto, a segunda recebe
 * um sufixo — assim as duas são importadas e a chave continua estável se o arquivo for
 * reenviado, que é o que o índice único de dedupe precisa.
 */
function uniqueId(movement: Movement, used: Map<string, number>): string {
  const base = [
    movement.occurredAt.toISOString().slice(0, 16),
    movement.amount.toFixed(2),
    normalizeHeader(movement.kind).replace(/\s+/g, '-'),
    normalizeHeader(movement.counterparty).replace(/\s+/g, '-'),
  ].join('|');

  const seen = (used.get(base) ?? 0) + 1;
  used.set(base, seen);
  return seen === 1 ? base : `${base}#${seen}`;
}

function round(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function money(amount: number): string {
  return `R$ ${amount.toFixed(2).replace('.', ',')}`;
}
