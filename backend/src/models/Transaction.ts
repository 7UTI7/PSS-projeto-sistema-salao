import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type TransactionType = 'receita' | 'despesa';
export type Professional = 'Nicolle' | 'Stefany';
export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro';

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
    paymentMethod: { type: String, enum: ['pix', 'credito', 'debito', 'dinheiro'], required: true },
    occurredAt: { type: Date, required: true, index: true },
    settledAt: { type: Date },
    status: { type: String, enum: ['pendente', 'liquidada', 'cancelada'], default: 'pendente', required: true },
    origin: { type: String, enum: ['manual', 'booksy', 'infinitepay'], default: 'manual', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, versionKey: false },
);

transactionSchema.index({ occurredAt: 1, type: 1, deletedAt: 1 });

export const Transaction = model<TransactionFields>('Transaction', transactionSchema);