import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  isLoading: boolean;

  setAuth: (token: string, user: User, mustChangePassword?: boolean) => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  setMustChangePassword: (mustChange: boolean) => void;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

const TOKEN_KEY = 'studio_auth_token';
const USER_KEY = 'studio_auth_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  mustChangePassword: false,
  isLoading: true,

  setAuth: async (token: string, user: User, mustChangePassword = false) => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch {
      // Falha silenciosa no SecureStore (ex: web local fallback)
    }

    set({
      token,
      user,
      isAuthenticated: true,
      mustChangePassword: !!mustChangePassword,
      isLoading: false,
    });
  },

  updateUser: (updatedFields: Partial<User>) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...updatedFields };
    set({ user: updated });
    try {
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(updated));
    } catch {
      // Ignora erro de persistência secundária
    }
  },

  setMustChangePassword: (mustChange: boolean) => {
    set({ mustChangePassword: mustChange });
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch {
      // Ignora erro
    }

    set({
      token: null,
      user: null,
      isAuthenticated: false,
      mustChangePassword: false,
      isLoading: false,
    });
  },

  loadSession: async () => {
    set({ isLoading: true });
    try {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const storedUser = await SecureStore.getItemAsync(USER_KEY);

      if (storedToken && storedUser) {
        const parsedUser: User = JSON.parse(storedUser);
        set({
          token: storedToken,
          user: parsedUser,
          isAuthenticated: true,
          mustChangePassword: !!parsedUser.mustChangePassword,
          isLoading: false,
        });
        return;
      }
    } catch {
      // Fallback
    }

    set({
      token: null,
      user: null,
      isAuthenticated: false,
      mustChangePassword: false,
      isLoading: false,
    });
  },
}));
