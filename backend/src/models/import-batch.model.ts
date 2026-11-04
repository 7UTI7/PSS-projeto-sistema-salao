// Modelo Mongoose dos lotes de importação (Booksy/InfinitePay).
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/** Soma do que o lote representa em dinheiro; guardada para o resumo não recalcular tudo. */
export interface ImportTotalsFields {
  grossAmount: number;
  discountAmount: number;
  feeAmount: number;
  commissionAmount: number;
  netAmount: number;
  studioNetProfit: number;
}

export interface ImportBatchFields {
  source: 'booksy' | 'infinitepay';
  fileName: string;
  contentHash: string;
  /** Linhas já normalizadas do arquivo, para auditoria sem reprocessar o original. */
  rawPayload: unknown;
  status: 'received' | 'processed' | 'failed' | 'rolled_back';
  importedCount: number;
  duplicateCount: number;
  skippedCount: number;
  periodStart?: Date;
  periodEnd?: Date;
  totals: ImportTotalsFields;
  errorMessage?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type ImportBatchDocument = HydratedDocument<ImportBatchFields>;

const totalsSchema = new Schema<ImportTotalsFields>(
  {
    grossAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    feeAmount: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    studioNetProfit: { type: Number, default: 0 },
  },
  { _id: false },
);

const importBatchSchema = new Schema<ImportBatchFields>(
  {
    source: { type: String, enum: ['booksy', 'infinitepay'], required: true },
    fileName: { type: String, required: true, maxlength: 255 },
    contentHash: { type: String, required: true, index: true },
    rawPayload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['received', 'processed', 'failed', 'rolled_back'], default: 'received' },
    importedCount: { type: Number, default: 0, min: 0 },
    duplicateCount: { type: Number, default: 0, min: 0 },
    skippedCount: { type: Number, default: 0, min: 0 },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    totals: { type: totalsSchema, default: () => ({}) },
    errorMessage: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

importBatchSchema.index({ createdAt: -1 });

export const ImportBatch = model<ImportBatchFields>('ImportBatch', importBatchSchema);
