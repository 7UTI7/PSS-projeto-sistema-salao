import { api } from './api';
import { ApiResponse, Category, TransactionType } from '../types';

export const categoryService = {
  async list(): Promise<Category[]> {
    const response = await api.get<ApiResponse<Category[]>>('/categories');
    return response.data.data;
  },

  async create(name: string, type: TransactionType): Promise<Category> {
    const response = await api.post<ApiResponse<Category>>('/categories', {
      name,
      type,
    });
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete<ApiResponse<null>>(`/categories/${id}`);
  },
};
