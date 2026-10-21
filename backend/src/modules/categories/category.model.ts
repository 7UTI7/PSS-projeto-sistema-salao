// Modelo Mongoose do catálogo de categorias gerenciado pelo admin.
import { Schema, model, type HydratedDocument } from 'mongoose';

export type CategoryKind = 'receita' | 'despesa' | 'ambos';

export interface CategoryFields {
  name: string;
  kind: CategoryKind;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type CategoryDocument = HydratedDocument<CategoryFields>;

const categorySchema = new Schema<CategoryFields>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    kind: { type: String, enum: ['receita', 'despesa', 'ambos'], default: 'ambos', required: true },
    active: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, versionKey: false },
);

categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'pt', strength: 2 } });

export const Category = model<CategoryFields>('Category', categorySchema);
