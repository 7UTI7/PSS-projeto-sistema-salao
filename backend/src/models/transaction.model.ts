// Modelo Mongoose dos lançamentos financeiros (receitas e despesas).
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type TransactionType = 'receita' | 'despesa';
export type Professional = 'Nicolle' | 'Stefany';
/** 'nao_informado' existe para as importações cuja origem não declara a forma de pagamento. */
export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro' | 'nao_informado';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['pix', 'credito', 'debito', 'dinheiro', 'nao_informado'];

export interface TransactionFields {
  type: TransactionType;
  description: string;
  grossAmount: number;
  discountAmount: number;
  feeAmount: number;
  professional: Professional;
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
    professional: { type: String, enum: ['Nicolle', 'Stefany'], required: true, index: true },
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