// Modelo Mongoose dos lançamentos financeiros (receitas e despesas).
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type TransactionType = 'receita' | 'despesa';
export type Professional = 'Nicolle' | 'Stefany';
/** 'nao_informado' existe para as importações cuja origem não declara a forma de pagamento. */
export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro' | 'nao_informado';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['pix', 'credito', 'debito', 'dinheiro', 'nao_informado'];

/**
 * Motivo pelo qual o faturamento do Booksy e as entradas da InfinitePay não fecham.
 * É o que a dona escolhe na auditoria, e é ele que decide o efeito no DRE.
 */
export type AuditReason = 'dinheiro' | 'taxa' | 'gorjeta' | 'estorno' | 'outro';
export const AUDIT_REASONS: readonly AuditReason[] = ['dinheiro', 'taxa', 'gorjeta', 'estorno', 'outro'];

/**
 * De que lado está a sobra. `faltou_entrar`: o Booksy registrou mais do que caiu na conta
 * (dinheiro em espécie, taxa retida). `entrou_a_mais`: caiu mais do que foi vendido
 * (gorjeta, entrada que não é serviço).
 */
export type AuditDirection = 'faltou_entrar' | 'entrou_a_mais';
export const AUDIT_DIRECTIONS: readonly AuditDirection[] = ['faltou_entrar', 'entrou_a_mais'];

export interface TransactionFields {
  type: TransactionType;
  description: string;
  grossAmount: number;
  discountAmount: number;
  feeAmount: number;
  /**
   * Quem atendeu. Opcional porque o extrato da InfinitePay não informa: um Pix recebido
   * não diz a qual atendimento pertence. Atribuir à titular por padrão criava comissão e
   * divisão de receita em cima de um palpite.
   */
  professional?: Professional;
  commissionAmount: number;
  studioNetProfit: number;
  netAmount: number;
  category: string;
  costType?: 'fixo' | 'variavel';
  paymentMethod: PaymentMethod;
  occurredAt: Date;
  settledAt?: Date;
  status: 'pendente' | 'liquidada' | 'cancelada';
  origin: 'manual' | 'booksy' | 'infinitepay';
  /**
   * `false` tira a linha do DRE sem tirá-la do caixa. Dois casos usam isso:
   *   - retirada da titular: dinheiro saindo da conta da InfinitePay para a conta do
   *     salão. É troca de bolso, não despesa; lançá-la no DRE zerava o lucro todo mês,
   *     porque ela retira quase tudo o que entra.
   *   - ajuste de auditoria por "dinheiro": o serviço já está no faturamento do Booksy,
   *     então contar o pagamento em espécie outra vez dobraria a receita.
   */
  countsInDre: boolean;
  /** Preenchido quando o lançamento existe para justificar a diferença da auditoria. */
  auditReason?: AuditReason;
  /**
   * Presente = este lançamento entra na comparação Booksy × InfinitePay. Ausente = é um
   * lançamento comum (aluguel, material), que só mexe no DRE.
   */
  auditDirection?: AuditDirection;
  /** Lote que criou o lançamento; permite desfazer uma importação inteira. */
  importBatchId?: Types.ObjectId;
  /** Id da linha na plataforma de origem (reserva do Booksy, transação da InfinitePay). */
  externalId?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type TransactionDocument = HydratedDocument<TransactionFields>;

const transactionSchema = new Schema<TransactionFields>(
  {
    type: { type: String, enum: ['receita', 'despesa'], required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 240 },
    grossAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    feeAmount: { type: Number, default: 0, min: 0 },
    professional: { type: String, enum: ['Nicolle', 'Stefany'], index: true },
    commissionAmount: { type: Number, default: 0, min: 0 },
    studioNetProfit: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    costType: { type: String, enum: ['fixo', 'variavel'] },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    occurredAt: { type: Date, required: true, index: true },
    settledAt: { type: Date },
    status: { type: String, enum: ['pendente', 'liquidada', 'cancelada'], default: 'pendente', required: true },
    origin: { type: String, enum: ['manual', 'booksy', 'infinitepay'], default: 'manual', required: true },
    countsInDre: { type: Boolean, default: true, required: true },
    auditReason: { type: String, enum: AUDIT_REASONS },
    auditDirection: { type: String, enum: AUDIT_DIRECTIONS, index: true },
    importBatchId: { type: Schema.Types.ObjectId, ref: 'ImportBatch', index: true },
    externalId: { type: String, trim: true, maxlength: 120 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, versionKey: false },
);

transactionSchema.index({ occurredAt: 1, type: 1, deletedAt: 1 });
// Deduplicação por linha: o mesmo agendamento não entra duas vezes, mesmo em arquivos diferentes.
transactionSchema.index(
  { origin: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } },
);

export const Transaction = model<TransactionFields>('Transaction', transactionSchema);