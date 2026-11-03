import { api } from './api';
import { ApiResponse, Transaction, CreateTransactionDTO } from '../types';

export interface TransactionFilterParams {
  startDate?: string;
  endDate?: string;
  type?: 'receita' | 'despesa';
  category?: string;
  status?: 'pendente' | 'liquidado' | 'cancelado';
}

export const transactionService = {
  async list(params?: TransactionFilterParams): Promise<Transaction[]> {
    const response = await api.get<ApiResponse<Transaction[]>>('/transactions', {
      params,
    });
    return response.data.data;
  },

  async getById(id: string): Promise<Transaction> {
    const response = await api.get<ApiResponse<Transaction>>(`/transactions/${id}`);
    return response.data.data;
  },

  async create(data: CreateTransactionDTO): Promise<Transaction> {
    const response = await api.post<ApiResponse<Transaction>>('/transactions', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<CreateTransactionDTO>): Promise<Transaction> {
    const response = await api.put<ApiResponse<Transaction>>(`/transactions/${id}`, data);
    return response.data.data;
  },

  async settle(id: string): Promise<Transaction> {
    const response = await api.put<ApiResponse<Transaction>>(`/transactions/${id}`, {
      status: 'liquidado',
    });
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    // API adota soft delete no backend
    await api.delete<ApiResponse<null>>(`/transactions/${id}`);
  },
};
