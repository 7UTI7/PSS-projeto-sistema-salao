import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface ImportBatchFields {
  source: 'booksy' | 'infinitepay';
  fileName: string;
  contentHash: string;
  rawPayload: Schema.Types.Mixed;
  status: 'received' | 'processed' | 'failed' | 'rolled_back';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type ImportBatchDocument = HydratedDocument<ImportBatchFields>;

const importBatchSchema = new Schema<ImportBatchFields>(
  {
    source: { type: String, enum: ['booksy', 'infinitepay'], required: true },
    fileName: { type: String, required: true, maxlength: 255 },
    contentHash: { type: String, required: true, index: true },
    rawPayload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['received', 'processed', 'failed', 'rolled_back'], default: 'received' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const ImportBatch = model<ImportBatchFields>('ImportBatch', importBatchSchema);