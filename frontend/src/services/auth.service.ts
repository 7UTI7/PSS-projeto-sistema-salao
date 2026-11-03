import { api } from './api';
import { ApiResponse, User } from '../types';

export interface LoginResponseData {
  token: string;
  user: User;
  mustChangePassword?: boolean;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponseData> {
    const response = await api.post<ApiResponse<LoginResponseData>>('/auth/login', {
      email,
      password,
    });
    return response.data.data;
  },

  async register(name: string, email: string, password: string): Promise<void> {
    await api.post<ApiResponse<null>>('/auth/register', {
      name,
      email,
      password,
    });
  },

  async forgotPassword(email: string): Promise<string> {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', {
      email,
    });
    return response.data.message || 'Se o e-mail existir, as instruções foram enviadas.';
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await api.post<ApiResponse<null>>('/auth/reset-password', {
      token,
      password,
    });
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await api.post<ApiResponse<null>>('/auth/change-password', {
      oldPassword,
      newPassword,
    });
  },

  async listUsers(): Promise<User[]> {
    const response = await api.get<ApiResponse<User[]>>('/auth/users');
    return response.data.data;
  },

  async createUser(data: { name: string; email: string; role: 'admin' | 'colaborador' }): Promise<User> {
    const response = await api.post<ApiResponse<User>>('/auth/users', data);
    return response.data.data;
  },

  async deactivateUser(id: string): Promise<void> {
    await api.delete<ApiResponse<null>>(`/auth/users/${id}`);
  },
};
