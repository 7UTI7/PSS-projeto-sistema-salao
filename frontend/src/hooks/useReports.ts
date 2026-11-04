// Hooks dos relatórios DRE e Fluxo de Caixa, sempre no mês de referência do app.
//
// As duas rotas são restritas ao admin. Em vez de deixar a tela receber um 403, as
// queries só rodam quando o usuário logado é admin (`enabled`), e a tela mostra o
// aviso de acesso restrito.
import { useQuery } from '@tanstack/react-query';
import { reportService } from '../services/report.service';
import { queryKeys } from '../services/query-keys';
import { usePeriodStore } from '../store/periodStore';
import { useAuthStore } from '../store/authStore';

export function useIsAdmin(): boolean {
  return useAuthStore((state) => state.user?.role === 'admin');
}

export function useDreReport() {
  const period = usePeriodStore((state) => state.period);
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.reports.dre(period),
    queryFn: () => reportService.getDre(period),
    enabled: isAdmin,
  });
}

export function useCashFlowReport() {
  const period = usePeriodStore((state) => state.period);
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.reports.cashFlow(period),
    queryFn: () => reportService.getCashFlow(period),
    enabled: isAdmin,
  });
}
