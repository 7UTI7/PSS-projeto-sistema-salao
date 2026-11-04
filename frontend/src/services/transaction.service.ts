// Chamadas de /api/transactions. Corresponde a backend/src/routes/transaction.routes.ts.
//
// Duas coisas que a API impõe e que moldam este arquivo:
//  1. GET /transactions não aceita filtros: devolve os 500 lançamentos mais recentes.
//     Período, tipo e busca são aplicados no app (ver filterTransactions).
//  2. PUT /transactions/:id valida o objeto inteiro, não um patch. Por isso toda edição
//     passa por toTransactionInput, que reconstrói o corpo completo a partir do registro.
import { api } from './api';
import { ApiResponse, Transaction, TransactionInput } from '../types';
import { isWithinPeriod, PeriodKey } from '../utils/period';

export interface TransactionFilters {
  period?: PeriodKey;
  type?: Transaction['type'];
  status?: Transaction['status'];
  search?: string;
}

export const transactionService = {
  async list(): Promise<Transaction[]> {
    const response = await api.get<ApiResponse<Transaction[]>>('/transactions');
    return response.data.data;
  },

  async create(input: TransactionInput): Promise<Transaction> {
    const response = await api.post<ApiResponse<Transaction>>('/transactions', input);
    return response.data.data;
  },

  async update(id: string, input: TransactionInput): Promise<Transaction> {
    const response = await api.put<ApiResponse<Transaction>>(`/transactions/${id}`, input);
    return response.data.data;
  },

  /** Marca como liquidada preenchendo settledAt — é o que alimenta o Fluxo de Caixa. */
  async settle(transaction: Transaction, settledAt = new Date().toISOString()): Promise<Transaction> {
    return transactionService.update(transaction._id, {
      ...toTransactionInput(transaction),
      status: 'liquidada',
      settledAt,
    });
  },

  /** Soft delete no backend: o lançamento sai das listas e dos relatórios. */
  async remove(id: string): Promise<void> {
    await api.delete(`/transactions/${id}`);
  },
};

/**
 * Converte um lançamento devolvido pela API no corpo aceito por POST/PUT.
 * As alíquotas não voltam na resposta (só os valores calculados), então são
 * reconstruídas a partir da base de cálculo para que uma edição não zere taxa
 * e comissão sem a dona perceber.
 */
export function toTransactionInput(transaction: Transaction): TransactionInput {
  const baseAmount = transaction.grossAmount - transaction.discountAmount;

  return {
    type: transaction.type,
    description: transaction.description,
    grossAmount: transaction.grossAmount,
    discountAmount: transaction.discountAmount,
    paymentFeeRate: baseAmount > 0 ? transaction.feeAmount / baseAmount : 0,
    professionalCommissionRate: baseAmount > 0 ? transaction.commissionAmount / baseAmount : 0,
    professional: transaction.professional,
    category: transaction.category,
    ...(transaction.costType ? { costType: transaction.costType } : {}),
    paymentMethod: transaction.paymentMethod,
    occurredAt: transaction.occurredAt,
    ...(transaction.settledAt ? { settledAt: transaction.settledAt } : {}),
    status: transaction.status,
  };
}

/** Filtro local, já que a API não filtra. Mantido aqui para as telas compartilharem a regra. */
export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters
): Transaction[] {
  const term = filters.search?.trim().toLowerCase() ?? '';

  return transactions.filter((transaction) => {
    if (filters.period && !isWithinPeriod(transaction.occurredAt, filters.period)) return false;
    if (filters.type && transaction.type !== filters.type) return false;
    if (filters.status && transaction.status !== filters.status) return false;
    if (!term) return true;

    return (
      transaction.description.toLowerCase().includes(term) ||
      transaction.category.toLowerCase().includes(term) ||
      (transaction.professional?.toLowerCase().includes(term) ?? false)
    );
  });
}
