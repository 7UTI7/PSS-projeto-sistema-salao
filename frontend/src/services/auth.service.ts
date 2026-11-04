// Chamadas de /api/auth. Corresponde a backend/src/routes/auth.routes.ts.
import { api } from './api';
import { ApiMessageResponse, ApiResponse, User, UserListItem, UserRole } from '../types';

/**
 * O backend devolve { token, user } e já embute mustChangePassword dentro de user
 * (somando a troca obrigatória e a senha vencida há mais de 90 dias).
 */
export interface LoginResponseData {
  token: string;
  user: User;
}

export interface CreateUserInput {
  name: string;
  email: string;
  /** Mínimo de 12 caracteres: é a política do backend (passwordSchema). */
  password: string;
  role: UserRole;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponseData> {
    const response = await api.post<ApiResponse<LoginResponseData>>('/auth/login', {
      email,
      password,
    });
    return response.data.data;
  },

  /** Cadastro público: responde 202 sem token, porque exige confirmação por e-mail. */
  async register(name: string, email: string, password: string): Promise<string> {
    const response = await api.post<ApiMessageResponse>('/auth/register', {
      name,
      email,
      password,
    });
    return response.data.message;
  },

  async forgotPassword(email: string): Promise<string> {
    const response = await api.post<ApiMessageResponse>('/auth/forgot-password', { email });
    return response.data.message || 'Se a conta existir, enviaremos instruções de redefinição.';
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<string> {
    const response = await api.post<ApiMessageResponse>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data.message;
  },

  /** Gestão de equipe (admin): GET /auth/users. */
  async listUsers(): Promise<UserListItem[]> {
    const response = await api.get<ApiResponse<UserListItem[]>>('/auth/users');
    return response.data.data;
  },

  /** Cria a conta já com troca de senha obrigatória no primeiro acesso. */
  async createUser(input: CreateUserInput): Promise<string> {
    const response = await api.post<ApiMessageResponse>('/auth/users', input);
    return response.data.message;
  },

  /** Desativa (soft delete) a conta; a API recusa desativar a si mesma ou o último admin. */
  async deactivateUser(id: string): Promise<void> {
    await api.delete(`/auth/users/${id}`);
  },
};
