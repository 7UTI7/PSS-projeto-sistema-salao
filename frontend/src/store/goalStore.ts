// Meta de faturamento do mês, editável pela dona.
//
// Fica no aparelho (expo-secure-store, o mesmo usado para o token) e não na API: a API
// não tem cadastro de metas, e criar um módulo inteiro no servidor para guardar um único
// número seria desproporcional. A consequência é honesta e vale registrar: a meta é por
// aparelho, então trocar de celular recomeça do valor padrão.
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const GOAL_KEY = 'studio.monthlyGoal';

/** Valor inicial, usado até ela definir o dela. */
export const DEFAULT_MONTHLY_GOAL = 5000;

interface GoalState {
  goal: number;
  /** false até a leitura do armazenamento terminar, para a tela não piscar o padrão. */
  loaded: boolean;
  setGoal: (goal: number) => void;
  loadGoal: () => Promise<void>;
}

export const useGoalStore = create<GoalState>((set) => ({
  goal: DEFAULT_MONTHLY_GOAL,
  loaded: false,

  setGoal: (goal: number) => {
    const safe = Number.isFinite(goal) && goal > 0 ? goal : DEFAULT_MONTHLY_GOAL;
    set({ goal: safe });
    // Gravação em segundo plano: a tela não espera o disco para mostrar o novo valor.
    void SecureStore.setItemAsync(GOAL_KEY, String(safe)).catch(() => {
      // Sem armazenamento (web, por exemplo) a meta vale só nesta sessão.
    });
  },

  loadGoal: async () => {
    try {
      const stored = await SecureStore.getItemAsync(GOAL_KEY);
      const parsed = stored === null ? Number.NaN : Number(stored);
      if (Number.isFinite(parsed) && parsed > 0) {
        set({ goal: parsed, loaded: true });
        return;
      }
    } catch {
      // SecureStore não existe no web; segue com o padrão.
    }
    set({ loaded: true });
  },
}));
