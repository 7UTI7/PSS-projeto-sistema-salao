// Trilha da auditoria de um mês: a submissão que confrontou Booksy e InfinitePay.
//
// O QUE ESTE DOCUMENTO GUARDA — E O QUE NÃO GUARDA
// Guarda só fato imutável: de que lotes o mês veio, quanto cada arquivo declarou no
// momento da submissão, e quando a auditoria fechou.
//
// NÃO guarda a diferença nem o status. Os dois são calculados na leitura, a partir dos
// lançamentos do mês (ver audit.service.ts). Se fossem colunas, qualquer lançamento
// manual posterior as deixaria mentindo — e o ponto da auditoria é justamente que a
// diferença se mova quando ela justifica a diferença.
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface AuditFields {
  /** Mês auditado, no formato 'AAAA-MM'. Um documento por mês. */
  period: string;
  booksyBatchId?: Types.ObjectId;
  infinitepayBatchId?: Types.ObjectId;
  /** Faturamento líquido do Booksy (bruto − descontos) quando o arquivo entrou. */
  faturamentoBooksy: number;
  /** Entradas do extrato da InfinitePay quando o arquivo entrou. */
  entradasInfinitepay: number;
  /** Primeira vez que a diferença chegou a zero. Null enquanto não fechou. */
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type AuditDocument = HydratedDocument<AuditFields>;

const auditSchema = new Schema<AuditFields>(
  {
    period: { type: String, required: true, unique: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    booksyBatchId: { type: Schema.Types.ObjectId, ref: 'ImportBatch' },
    infinitepayBatchId: { type: Schema.Types.ObjectId, ref: 'ImportBatch' },
    faturamentoBooksy: { type: Number, default: 0 },
    entradasInfinitepay: { type: Number, default: 0 },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);

export const Audit = model<AuditFields>('Audit', auditSchema);
