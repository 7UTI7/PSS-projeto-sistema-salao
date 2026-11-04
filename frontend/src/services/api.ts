import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { ApiErrorResponse } from '../types';

// URL base da API do Sistema Salão, vinda de frontend/.env (EXPO_PUBLIC_API_URL).
// Em dispositivo físico via Expo Go, 'localhost' aponta para o próprio celular:
// use o IP da máquina na rede (ex: http://192.168.68.108:3000/api) ou, no emulador
// Android, http://10.0.2.2:3000/api.
export const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 15000,
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
 * Envia multipart/form-data (usado só na importação de relatórios).
 * O Content-Type não é definido à mão: o axios precisa gerar o boundary,
 * e informar o header sem boundary faz o backend recusar o arquivo.
 */
export async function postFormData<T>(
  path: string,
  form: FormData,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await api.post<T>(path, form, {
    ...config,
    headers: { ...config?.headers, 'Content-Type': 'multipart/form-data' },
    // Processar uma planilha inteira leva mais tempo que uma requisição comum.
    timeout: 60000,
    transformRequest: (data) => data,
  });
  return response.data;
}

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
      return `Não foi possível conectar à API (${DEFAULT_API_URL}). Verifique sua conexão e se a API está rodando.`;
    }
    if (error.response.status === 403) {
      return 'Esta área é restrita ao perfil de administradora.';
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Ocorreu um erro inesperado. Tente novamente.';
}
