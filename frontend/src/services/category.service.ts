// Chamadas de /api/categories. Corresponde a backend/src/routes/category.routes.ts.
//
// Leitura é liberada para os dois perfis (a colaboradora precisa do catálogo para lançar);
// criar, editar e remover é só para admin. O campo é `kind`, não `type`: o backend usa
// 'receita' | 'despesa' | 'ambos' para dizer em que tipo de lançamento a categoria vale.
import { api } from './api';
import { ApiResponse, Category, CategoryInput, TransactionType } from '../types';

export const categoryService = {
  async list(): Promise<Category[]> {
    const response = await api.get<ApiResponse<Category[]>>('/categories');
    return response.data.data;
  },

  async create(input: CategoryInput): Promise<Category> {
    const response = await api.post<ApiResponse<Category>>('/categories', input);
    return response.data.data;
  },

  async update(id: string, input: CategoryInput): Promise<Category> {
    const response = await api.put<ApiResponse<Category>>(`/categories/${id}`, input);
    return response.data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/categories/${id}`);
  },
};

/**
 * Categorias que podem receber um lançamento deste tipo. A API recusa com
 * INVALID_CATEGORY quando a categoria está inativa ou é de outro tipo, então
 * o formulário já oferece só as válidas.
 */
export function categoriesForType(
  categories: readonly Category[],
  type: TransactionType
): Category[] {
  return categories.filter(
    (category) => category.active && (category.kind === 'ambos' || category.kind === type)
  );
}
