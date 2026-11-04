// Mês de referência compartilhado por todas as telas.
//
// O seletor de período fica no StudioTopHeader, mas quem consome é o Dashboard, a lista
// de lançamentos e os relatórios. Guardar no store evita passar o período por props
// através de três níveis de navegação e mantém a escolha ao trocar de aba.
import { create } from 'zustand';
import { currentPeriodKey, PeriodKey, shiftPeriod } from '../utils/period';

interface PeriodState {
  period: PeriodKey;
  setPeriod: (period: PeriodKey) => void;
  goToPreviousPeriod: () => void;
  goToNextPeriod: () => void;
  resetToCurrentPeriod: () => void;
}

export const usePeriodStore = create<PeriodState>((set, get) => ({
  period: currentPeriodKey(),

  setPeriod: (period: PeriodKey) => set({ period }),

  goToPreviousPeriod: () => set({ period: shiftPeriod(get().period, -1) }),

  // Não avança além do mês corrente: não há dado futuro para mostrar.
  goToNextPeriod: () => {
    const next = shiftPeriod(get().period, 1);
    if (next <= currentPeriodKey()) set({ period: next });
  },

  resetToCurrentPeriod: () => set({ period: currentPeriodKey() }),
}));
