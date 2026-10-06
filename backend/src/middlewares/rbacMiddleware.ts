import type { RequestHandler } from 'express';
import type { UserRole } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

export function rbacMiddleware(...allowedRoles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) return next(new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED'));
    if (!allowedRoles.includes(request.user.role)) {
      return next(new AppError('Acesso não autorizado.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}