import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { ApiErrorResponse } from '../types';

// URL base padrão da API do Sistema Salão
// Dica: Para testar em dispositivo físico via Expo Go na mesma rede Wi-Fi,
// altere 'localhost' para o IP da sua máquina (ex: 'http://192.168.1.50:3000/api')
// ou use variável de ambiente EXPO_PUBLIC_API_URL.
export const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de Requisição: Anexa o Bearer JWT automaticamente
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de Resposta: Tratamento de erros e expiração de sessão (401)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      // Token expirado ou inválido (ex: limite de 8h atingido)
      const { isAuthenticated, logout } = useAuthStore.getState();
      if (isAuthenticated) {
        await logout();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Utilitário para extrair mensagem amigável de erro da API
 */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiErrorResponse | undefined;
    if (apiError?.message) {
      return apiError.message;
    }
    if (error.code === 'ECONNABORTED') {
      return 'Tempo limite de conexão excedido. Verifique o servidor.';
    }
    if (!error.response) {
      return 'Não foi possível conectar à API. Verifique sua conexão e se a API está rodando.';
    }
  }
  return 'Ocorreu um erro inesperado. Tente novamente.';
}
