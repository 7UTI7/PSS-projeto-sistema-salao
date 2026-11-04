// Hooks de lançamentos: leitura filtrada pelo período e mutações que invalidam o cache.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  filterTransactions,
  transactionService,
  type TransactionFilters,
} from '../services/transaction.service';
import { queryKeys } from '../services/query-keys';
import type { Transaction, TransactionInput } from '../types';
import { usePeriodStore } from '../store/periodStore';

/**
 * Lista completa que a API devolve (até 500 lançamentos recentes). As telas quase sempre
 * querem a versão filtrada — use useFilteredTransactions.
 */
export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions.list(),
    queryFn: transactionService.list,
  });
}

/** Default estável: um `{}` novo a cada render invalidaria o useMemo abaixo sempre. */
const NO_FILTERS: Omit<TransactionFilters, 'period'> = {};

/**
 * Lista já recortada. O filtro acontece no app porque GET /transactions não aceita
 * query params; assim uma troca de período não refaz a requisição.
 *
 * Quem passa `filters` precisa de uma referência estável (useMemo na tela), senão o
 * recorte é recalculado em todo render.
 */
export function useFilteredTransactions(filters = NO_FILTERS) {
  const period = usePeriodStore((state) => state.period);
  const query = useTransactions();

  const transactions = useMemo(
    () => filterTransactions(query.data ?? [], { ...filters, period }),
    [query.data, period, filters]
  );

  return { ...query, transactions };
}

/**
 * Lançamentos criam e mexem em valores que alimentam os relatórios, então toda mutação
 * invalida também reports — sem isso o Dashboard continuaria mostrando o total antigo.
 */
function useTransactionMutationOptions() {
  const queryClient = useQueryClient();
  return {
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
      ]);
    },
  };
}

export function useCreateTransaction() {
  const options = useTransactionMutationOptions();
  return useMutation({
    mutationFn: (input: TransactionInput) => transactionService.create(input),
    ...options,
  });
}

export function useUpdateTransaction() {
  const options = useTransactionMutationOptions();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransactionInput }) =>
      transactionService.update(id, input),
    ...options,
  });
}

export function useSettleTransaction() {
  const options = useTransactionMutationOptions();
  return useMutation({
    mutationFn: (transaction: Transaction) => transactionService.settle(transaction),
    ...options,
  });
}

export function useDeleteTransaction() {
  const options = useTransactionMutationOptions();
  return useMutation({
    mutationFn: (id: string) => transactionService.remove(id),
    ...options,
  });
}
