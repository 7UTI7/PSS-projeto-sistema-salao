import type { ErrorRequestHandler } from 'express';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  void _next;
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }

  logger.error({ err: error }, 'Erro não tratado na API');
  response.status(500).json({ status: 'error', message: 'Erro interno do servidor.' });
};