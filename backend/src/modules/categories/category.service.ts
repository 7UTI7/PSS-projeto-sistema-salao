// Regras de negócio do catálogo de categorias e validação de categoria nos lançamentos.
import { Category, type CategoryFields, type CategoryKind } from './category.model.js';
import { AppError } from '../../shared/utils/app-error.js';

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  active: boolean;
}

const collation = { locale: 'pt', strength: 2 } as const;

export class CategoryService {
  async list(onlyActive = false): Promise<unknown[]> {
    const filter = onlyActive ? { deletedAt: null, active: true } : { deletedAt: null };
    return Category.find(filter).sort({ name: 1 }).lean();
  }

  async getById(id: string): Promise<CategoryFields> {
    const category = await Category.findOne({ _id: id, deletedAt: null }).lean();
    if (!category) throw new AppError('Categoria não encontrada.', 404, 'NOT_FOUND');
    return category;
  }

  async create(input: CategoryInput): Promise<CategoryFields> {
    await this.assertNameFree(input.name);
    const category = await Category.create(input);
    return category.toObject();
  }

  async update(id: string, input: CategoryInput): Promise<CategoryFields> {
    await this.assertNameFree(input.name, id);
    const category = await Category.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: input },
      { new: true, runValidators: true },
    ).lean();
    if (!category) throw new AppError('Categoria não encontrada.', 404, 'NOT_FOUND');
    return category;
  }

  async softDelete(id: string): Promise<void> {
    const result = await Category.updateOne({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), active: false } });
    if (result.matchedCount === 0) throw new AppError('Categoria não encontrada.', 404, 'NOT_FOUND');
  }

  /** Garante que o nome existe no catálogo, está ativo e é compatível com o tipo do lançamento. */
  async assertActive(name: string, type: 'receita' | 'despesa'): Promise<void> {
    const category = await Category.findOne({ name, deletedAt: null, active: true }).collation(collation).lean();
    if (!category || (category.kind !== 'ambos' && category.kind !== type)) {
      throw new AppError('Categoria inválida ou inativa no catálogo.', 400, 'INVALID_CATEGORY');
    }
  }

  private async assertNameFree(name: string, ignoreId?: string): Promise<void> {
    const filter = ignoreId ? { name, deletedAt: null, _id: { $ne: ignoreId } } : { name, deletedAt: null };
    const duplicate = await Category.exists(filter).collation(collation);
    if (duplicate) throw new AppError('Já existe uma categoria com este nome.', 409, 'CATEGORY_EXISTS');
  }
}
