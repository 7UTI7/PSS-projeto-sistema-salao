import { create } from 'zustand';

interface A11yState {
  isDarkMode: boolean;
  fontScale: number; // 0.9, 1.0, 1.1, 1.2, 1.3
  highContrast: boolean;

  toggleDarkMode: () => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  toggleHighContrast: () => void;
}

export const useA11yStore = create<A11yState>((set) => ({
  isDarkMode: false,
  fontScale: 1.0,
  highContrast: false,

  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  increaseFontSize: () =>
    set((state) => ({ fontScale: Math.min(+(state.fontScale + 0.1).toFixed(1), 1.3) })),
  decreaseFontSize: () =>
    set((state) => ({ fontScale: Math.max(+(state.fontScale - 0.1).toFixed(1), 0.9) })),
  resetFontSize: () => set({ fontScale: 1.0 }),
  toggleHighContrast: () => set((state) => ({ highContrast: !state.highContrast })),
}));

