// Hooks do resumo financeiro, do Fluxo de Caixa e da Conciliação, no mês de referência.
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

/**
 * Resumo financeiro do mês. É o hook que o Painel e a tela de Lançamentos usam, para que
 * as duas telas mostrem exatamente os mesmos números.
 */
export function useFinancialSummary() {
  const period = usePeriodStore((state) => state.period);
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.reports.dre(period),
    queryFn: () => reportService.getFinancialSummary(period),
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

export function useReconciliation() {
  const period = usePeriodStore((state) => state.period);
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.reports.reconciliation(period),
    queryFn: () => reportService.getReconciliation(period),
    enabled: isAdmin,
  });
}
