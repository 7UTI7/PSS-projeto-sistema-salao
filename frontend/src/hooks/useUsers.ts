// Hooks da gestão de equipe (/auth/users), restrita ao admin.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, type CreateUserInput } from '../services/auth.service';
import { queryKeys } from '../services/query-keys';
import { useIsAdmin } from './useReports';

export function useUsers() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: authService.listUsers,
    enabled: isAdmin,
  });
}

function useUserMutationOptions() {
  const queryClient = useQueryClient();
  return {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  };
}

export function useCreateUser() {
  const options = useUserMutationOptions();
  return useMutation({
    mutationFn: (input: CreateUserInput) => authService.createUser(input),
    ...options,
  });
}

export function useDeactivateUser() {
  const options = useUserMutationOptions();
  return useMutation({
    mutationFn: (id: string) => authService.deactivateUser(id),
    ...options,
  });
}
