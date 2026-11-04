// Chaves do React Query em um só lugar.
//
// Uma mutação precisa invalidar exatamente as queries que ficaram velhas; com as chaves
// escritas à mão em cada tela, um lançamento novo aparecia na lista mas não no Dashboard.
// Daqui saem chaves hierárquicas: invalidar queryKeys.transactions.all derruba a lista e
// tudo que dependa dela.
import type { PeriodKey } from '../utils/period';

export const queryKeys = {
  transactions: {
    all: ['transactions'] as const,
    list: () => ['transactions', 'list'] as const,
  },
  categories: {
    all: ['categories'] as const,
    list: () => ['categories', 'list'] as const,
  },
  reports: {
    all: ['reports'] as const,
    dre: (period: PeriodKey) => ['reports', 'dre', period] as const,
    cashFlow: (period: PeriodKey) => ['reports', 'cash-flow', period] as const,
    // Fica sob 'reports' de propósito: a importação já invalida queryKeys.reports.all,
    // então a conciliação se atualiza junto com o Dashboard depois de cada upload.
    reconciliation: (period: PeriodKey) => ['reports', 'reconciliation', period] as const,
  },
  imports: {
    all: ['imports'] as const,
    batches: () => ['imports', 'batches'] as const,
  },
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
  },
};
