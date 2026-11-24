// Middleware global que converte erros em respostas JSON padronizadas.
import type { ErrorRequestHandler } from 'express';
import { logger } from '../../config/logger.js';
import { AppError } from '../utils/app-error.js';

const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  413: 'Conteúdo da requisição excede o tamanho permitido.',
  415: 'Tipo de conteúdo não suportado.',
};

function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const status = (error as { status?: unknown; statusCode?: unknown }).status ?? (error as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  void _next;
  if (error instanceof AppError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      logger.warn({
        event: 'access_denied',
        status: error.statusCode,
        method: request.method,
        path: request.originalUrl.split('?')[0],
        ...(request.user ? { userId: request.user.id } : {}),
      }, 'Acesso negado');
    }
    response.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }

  // Erros de cliente gerados pelo Express/body-parser (corpo grande demais, JSON malformado,
  // charset inválido) já trazem status 4xx. Antes viravam 500 com stack trace no log (achado do Wapiti).
  const clientStatus = clientErrorStatus(error);
  if (clientStatus) {
    logger.warn({ event: 'bad_request', status: clientStatus, method: request.method, path: request.originalUrl.split('?')[0] }, 'Requisição rejeitada');
    response.status(clientStatus).json({ status: 'error', message: CLIENT_ERROR_MESSAGES[clientStatus] ?? 'Requisição inválida.' });
    return;
  }

  logger.error({ err: error }, 'Erro não tratado na API');
  response.status(500).json({ status: 'error', message: 'Erro interno do servidor.' });
};