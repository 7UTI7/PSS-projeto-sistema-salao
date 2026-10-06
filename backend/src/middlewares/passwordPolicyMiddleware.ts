import type { RequestHandler } from 'express';
import { PASSWORD_MAX_AGE_DAYS } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

const PASSWORD_MAX_AGE_MS = PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export const passwordPolicyMiddleware: RequestHandler = (request, _response, next) => {
  const user = request.user;
  if (!user) return next(new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED'));

  const passwordExpired = Date.now() - user.lastPasswordChange.getTime() >= PASSWORD_MAX_AGE_MS;
  if (user.mustChangePassword || passwordExpired) {
    return next(new AppError('Troca de senha obrigatória.', 403, 'PASSWORD_CHANGE_REQUIRED'));
  }
  return next();
};