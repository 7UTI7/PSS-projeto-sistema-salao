// Hooks do catálogo de categorias.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesForType, categoryService } from '../services/category.service';
import { queryKeys } from '../services/query-keys';
import type { CategoryInput, TransactionType } from '../types';

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.list(),
    // O catálogo muda pouco: evita refazer a requisição a cada abertura do formulário.
    staleTime: 5 * 60 * 1000,
    queryFn: categoryService.list,
  });
}

/** Só as categorias que a API aceita para este tipo de lançamento. */
export function useCategoriesForType(type: TransactionType) {
  const query = useCategories();
  const categories = useMemo(() => categoriesForType(query.data ?? [], type), [query.data, type]);
  return { ...query, categories };
}

function useCategoryMutationOptions() {
  const queryClient = useQueryClient();
  return {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  };
}

export function useCreateCategory() {
  const options = useCategoryMutationOptions();
  return useMutation({
    mutationFn: (input: CategoryInput) => categoryService.create(input),
    ...options,
  });
}

export function useUpdateCategory() {
  const options = useCategoryMutationOptions();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CategoryInput }) =>
      categoryService.update(id, input),
    ...options,
  });
}

export function useDeleteCategory() {
  const options = useCategoryMutationOptions();
  return useMutation({
    mutationFn: (id: string) => categoryService.remove(id),
    ...options,
  });
}
