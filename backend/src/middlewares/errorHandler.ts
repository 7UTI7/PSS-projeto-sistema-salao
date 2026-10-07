import type { ErrorRequestHandler } from 'express';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';

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

  logger.error({ err: error }, 'Erro não tratado na API');
  response.status(500).json({ status: 'error', message: 'Erro interno do servidor.' });
};