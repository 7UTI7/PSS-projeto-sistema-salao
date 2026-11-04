// Sessão do usuário: token JWT, perfil e troca de senha obrigatória.
//
// O token vale 8h e vem do backend já com mustChangePassword resolvido (troca forçada no
// primeiro acesso ou senha vencida há mais de 90 dias). Enquanto a flag estiver ligada, a
// API responde 403 PASSWORD_CHANGE_REQUIRED em todas as rotas de negócio, então o
// AppNavigator usa esse estado para prender o app na tela de troca de senha.
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  isLoading: boolean;

  setAuth: (token: string, user: User) => Promise<void>;
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

  setAuth: async (token: string, user: User) => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch {
      // SecureStore não existe no web; a sessão vale só enquanto o app estiver aberto.
    }

    set({
      token,
      user,
      isAuthenticated: true,
      mustChangePassword: user.mustChangePassword,
      isLoading: false,
    });
  },

  updateUser: (updatedFields: Partial<User>) => {
    const current = get().user;
    if (!current) return;

    const updated = { ...current, ...updatedFields };
    set({ user: updated });
    try {
      void SecureStore.setItemAsync(USER_KEY, JSON.stringify(updated));
    } catch {
      // Persistência é secundária: o estado em memória já está correto.
    }
  },

  setMustChangePassword: (mustChange: boolean) => {
    set({ mustChangePassword: mustChange });
    get().updateUser({ mustChangePassword: mustChange });
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch {
      // Se não deu para apagar, limpar o estado já encerra a sessão no app.
    }

    set({
      token: null,
      user: null,
      isAuthenticated: false,
      mustChangePassword: false,
      isLoading: false,
    });
  },

  /**
   * Restaura a sessão guardada ao abrir o app. Não revalida o token aqui: a primeira
   * requisição que falhar com 401 cai no interceptor do axios, que faz logout.
   */
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
      // Dado corrompido ou SecureStore indisponível: começa deslogado.
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
