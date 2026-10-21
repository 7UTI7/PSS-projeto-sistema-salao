// Controle de acesso por perfil (admin/colaborador).
import type { RequestHandler } from 'express';
import type { UserRole } from '../../models/user.model.js';
import { AppError } from '../utils/app-error.js';

export function rbacMiddleware(...allowedRoles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) return next(new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED'));
    if (!allowedRoles.includes(request.user.role)) {
      return next(new AppError('Acesso não autorizado.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}