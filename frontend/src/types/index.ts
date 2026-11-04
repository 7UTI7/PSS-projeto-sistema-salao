// Tipos centrais do Frontend - Nicolle Neris Studio
//
// Espelham exatamente os schemas Zod e os models Mongoose da API. Quando um campo
// aqui divergir do backend, o app grava dado errado sem erro de compilação — então
// qualquer mudança nos enums ou nos nomes de campo precisa acontecer nos dois lados.
// Referência: backend/src/models/*.model.ts e backend/src/controllers/*.controller.ts

export type UserRole = 'admin' | 'colaborador';

/** Como a API devolve um usuário (AuthService.toPublicUser): o id vem em `id`, não em `_id`. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

/** GET /auth/users acrescenta estes campos ao usuário público. */
export interface UserListItem extends User {
  emailVerified: boolean;
  createdAt: string;
}

export type TransactionType = 'receita' | 'despesa';

/** Profissionais do estúdio; o backend mapeia admin -> Nicolle e colaborador -> Stefany. */
export type Professional = 'Nicolle' | 'Stefany';

/** 'nao_informado' só aparece em lançamentos importados cuja origem não declara a forma. */
export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro' | 'nao_informado';

/** Formas oferecidas no lançamento manual: 'nao_informado' é exclusivo da importação. */
export const SELECTABLE_PAYMENT_METHODS: readonly PaymentMethod[] = ['pix', 'credito', 'debito', 'dinheiro'];

export type TransactionStatus = 'pendente' | 'liquidada' | 'cancelada';

export type TransactionOrigin = 'manual' | 'booksy' | 'infinitepay';

export type CostType = 'fixo' | 'variavel';

/**
 * Lançamento como a API devolve. Os campos derivados (feeAmount, commissionAmount,
 * netAmount, studioNetProfit) são calculados no servidor — o app só os exibe.
 */
export interface Transaction {
  _id: string;
  type: TransactionType;
  description: string;
  grossAmount: number;
  discountAmount: number;
  feeAmount: number;
  /** Ausente nos lançamentos do extrato: a origem não informa quem atendeu. */
  professional?: Professional;
  commissionAmount: number;
  studioNetProfit: number;
  netAmount: number;
  category: string;
  costType?: CostType;
  paymentMethod: PaymentMethod;
  /** Data do atendimento — base do DRE (regime de competência). */
  occurredAt: string;
  /** Data em que o dinheiro entrou — base do Fluxo de Caixa (regime de caixa). */
  settledAt?: string;
  status: TransactionStatus;
  origin: TransactionOrigin;
  importBatchId?: string;
  externalId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Corpo de POST e PUT /transactions. O backend valida o objeto inteiro nos dois verbos,
 * então uma edição precisa reenviar todos os campos (não existe PATCH parcial).
 * As alíquotas vão como fração (0.0399 = 3,99%), não como percentual.
 */
export interface TransactionInput {
  type: TransactionType;
  description: string;
  grossAmount: number;
  discountAmount: number;
  /**
   * Omitido = usar a taxa padrão da forma de pagamento, resolvida no servidor. O app não
   * guarda mais tabela de taxa; só manda o percentual quando a dona digita um.
   */
  paymentFeeRate?: number;
  professionalCommissionRate: number;
  professional?: Professional;
  category: string;
  costType?: CostType;
  paymentMethod: PaymentMethod;
  occurredAt: string;
  settledAt?: string;
  status: TransactionStatus;
}

export type CategoryKind = 'receita' | 'despesa' | 'ambos';

export interface Category {
  _id: string;
  name: string;
  kind: CategoryKind;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  active: boolean;
}

/**
 * DRE gerencial (GET /reports/dre). Chaves em português porque é o que o
 * ReportService devolve; renomear aqui quebraria a leitura da resposta.
 */
/**
 * Resumo financeiro do mês (GET /reports/dre). É a única fonte dos números: o Painel e a
 * tela de Lançamentos leem este mesmo objeto, em vez de cada um somar do seu jeito.
 *
 * `comissoes` é repasse à profissional e vem em linha própria — não entra em `despesas`.
 */
export interface FinancialSummary {
  faturamentoBruto: number;
  descontos: number;
  taxas: number;
  receitaLiquida: number;
  comissoes: number;
  despesas: number;
  lucroEstudio: number;
  saldo: number;
}

/** Um dia do Fluxo de Caixa (GET /reports/cash-flow): saldo líquido do dia. */
export interface CashFlowPoint {
  date: string;
  amount: number;
}

// ---------------------------------------------------------------------------
// Auditoria Booksy x InfinitePay
// ---------------------------------------------------------------------------

/**
 * - `aprovada`      a diferença é zero. Libera os resultados.
 * - `divergente`    as duas fontes têm dado no mês e não fecham. Pede o motivo.
 * - `fonte_ausente` falta um dos dois arquivos no mês. NÃO pede motivo: o que falta é o
 *                   arquivo, e zerar isso com um ajuste seria falsear a auditoria.
 */
export type AuditOutcome = 'aprovada' | 'divergente' | 'fonte_ausente';

/** O motivo decide o sinal do ajuste e se ele entra no DRE; quem resolve é o servidor. */
export type AuditReason = 'dinheiro' | 'taxa' | 'gorjeta' | 'estorno' | 'outro';

/** `faltou_entrar` soma na comparação; `entrou_a_mais` subtrai. */
export type AuditDirection = 'faltou_entrar' | 'entrou_a_mais';

export interface AuditAdjustment {
  id: string;
  occurredAt: string;
  description: string;
  amount: number;
  reason: AuditReason | null;
  direction: AuditDirection;
  /** Valor com sinal, como entra na equação da auditoria. */
  signedAmount: number;
  countsInDre: boolean;
}

/**
 * Estado da auditoria de um mês (GET /audits?period=AAAA-MM).
 *
 * A equação: faturamentoBooksy − entradasInfinitepay − ajusteManual = diferenca.
 * Tudo é recalculado no servidor a cada leitura — nada é somado aqui.
 */
export interface AuditSummary {
  period: string;
  outcome: AuditOutcome;
  /** Líquido: bruto − descontos. O desconto é cortesia e nunca ia entrar na conta. */
  faturamentoBooksy: number;
  entradasInfinitepay: number;
  ajusteManual: number;
  diferenca: number;
  temBooksy: boolean;
  temInfinitepay: boolean;
  fonteFaltante: 'booksy' | 'infinitepay' | 'ambas' | null;
  adjustments: AuditAdjustment[];
  /** Entradas consolidadas: o que de fato entrou, já explicado. */
  saldoBruto: number;
  /** O que a titular tirou da conta da InfinitePay no mês. */
  saldoRetirado: number;
  /** saldoBruto − saldoRetirado: o que ainda está na conta. */
  saldoLiquido: number;
  approvedAt: string | null;
}

/** Resposta de POST /audits: os dois lotes e a auditoria de cada mês tocado. */
export interface AuditSubmitResult {
  booksy: ImportResult;
  infinitepay: ImportResult;
  audits: AuditSummary[];
}

export interface AuditEntryInput {
  amount: number;
  reason: AuditReason;
  description: string;
  /** Só obrigatório quando o motivo é "outro". */
  direction?: AuditDirection;
  type?: TransactionType;
}

// ---------------------------------------------------------------------------
// Importação de relatórios (Booksy / InfinitePay)
// ---------------------------------------------------------------------------

export type ImportSource = 'booksy' | 'infinitepay';

export type ImportBatchStatus = 'received' | 'processed' | 'failed' | 'rolled_back';

export interface ImportTotals {
  grossAmount: number;
  discountAmount: number;
  feeAmount: number;
  commissionAmount: number;
  netAmount: number;
  studioNetProfit: number;
}

/** Linha que o parser não aproveitou, com o motivo em texto para mostrar na tela. */
export interface SkippedRow {
  line: number;
  reason: string;
}

/** POST /imports/preview: o que entraria, sem gravar nada. */
export interface ImportPreview {
  source: ImportSource;
  fileName: string;
  contentHash: string;
  alreadyImported: boolean;
  rowCount: number;
  skipped: SkippedRow[];
  periodStart: string | null;
  periodEnd: string | null;
  totals: ImportTotals;
  missingCategories: string[];
}

/** POST /imports: o que efetivamente entrou. */
export interface ImportResult {
  batchId: string;
  source: ImportSource;
  fileName: string;
  importedCount: number;
  duplicateCount: number;
  skipped: SkippedRow[];
  createdCategories: string[];
  periodStart: string | null;
  periodEnd: string | null;
  totals: ImportTotals;
}

/** GET /imports: histórico de lotes. */
export interface ImportBatch {
  _id: string;
  source: ImportSource;
  fileName: string;
  status: ImportBatchStatus;
  importedCount: number;
  duplicateCount: number;
  skippedCount: number;
  periodStart?: string;
  periodEnd?: string;
  totals: ImportTotals;
  errorMessage?: string;
  createdAt: string;
}

/** Arquivo escolhido pelo expo-document-picker, pronto para virar multipart. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

// ---------------------------------------------------------------------------
// Envelopes da API
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  status: 'success';
  data: T;
  message?: string;
}

/** Respostas 202/204 trazem só mensagem, sem `data`. */
export interface ApiMessageResponse {
  status: 'success';
  message: string;
}

export interface ApiErrorResponse {
  status: 'error';
  message: string;
}
