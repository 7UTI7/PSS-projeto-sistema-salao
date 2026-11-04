// Tipos compartilhados do pipeline de importação (Booksy/InfinitePay).
import type { PaymentMethod, Professional, TransactionType } from '../../models/transaction.model.js';

export type ImportSource = 'booksy' | 'infinitepay';

/** Uma planilha lida do arquivo: nome da aba e as células já convertidas em texto. */
export interface SheetTable {
  name: string;
  rows: string[][];
}

/**
 * Linha já normalizada para o formato do domínio, antes de virar lançamento.
 * Os parsers de cada plataforma produzem este formato; o service grava.
 */
export interface ParsedRow {
  externalId: string;
  type: TransactionType;
  description: string;
  category: string;
  professional: Professional;
  grossAmount: number;
  discountAmount: number;
  paymentFeeRate: number;
  professionalCommissionRate: number;
  paymentMethod: PaymentMethod;
  occurredAt: Date;
  settledAt?: Date;
  status: 'pendente' | 'liquidada' | 'cancelada';
}

/** Linha que o parser não conseguiu aproveitar, com o motivo legível para a tela. */
export interface SkippedRow {
  line: number;
  reason: string;
}

/**
 * Movimento que o parser reconheceu mas deixou de propósito fora dos lançamentos, somado
 * para a tela poder mostrá-lo. O caso típico é a transferência da conta da InfinitePay para
 * a conta pessoal da titular: é dinheiro saindo da conta, mas não é despesa do salão — lançar
 * como despesa zeraria o lucro do mês, já que a dona retira quase tudo o que entra.
 */
export interface AsideTotal {
  label: string;
  count: number;
  amount: number;
  reason: string;
}

export interface ParseOutcome {
  rows: ParsedRow[];
  skipped: SkippedRow[];
  /** Vazio quando a origem não tem movimentos desse tipo (é o caso do Booksy). */
  asides: AsideTotal[];
}

export interface ParseOptions {
  /** Comissão aplicada às receitas quando a planilha de origem não informa o percentual. */
  defaultCommissionRate: number;
}

/** Soma do que a importação representa em dinheiro, exibida no resumo da tela. */
export interface ImportTotals {
  grossAmount: number;
  discountAmount: number;
  feeAmount: number;
  commissionAmount: number;
  netAmount: number;
  studioNetProfit: number;
}

export interface ImportPreview {
  source: ImportSource;
  fileName: string;
  contentHash: string;
  /** true quando este mesmo arquivo já foi processado antes (dedupe por hash). */
  alreadyImported: boolean;
  rowCount: number;
  skipped: SkippedRow[];
  asides: AsideTotal[];
  periodStart: Date | null;
  periodEnd: Date | null;
  totals: ImportTotals;
  missingCategories: string[];
  /**
   * Avisos que não impedem a importação mas mudam o que ela significa — hoje, o período
   * se sobrepor a um lote da outra origem, o que duplicaria a receita.
   */
  warnings: string[];
  rows: ParsedRow[];
}

export interface ImportResult {
  batchId: string;
  source: ImportSource;
  fileName: string;
  importedCount: number;
  duplicateCount: number;
  skipped: SkippedRow[];
  asides: AsideTotal[];
  createdCategories: string[];
  periodStart: Date | null;
  periodEnd: Date | null;
  totals: ImportTotals;
}
