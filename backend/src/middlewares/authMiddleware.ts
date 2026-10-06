import type { RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authMiddleware: RequestHandler = asyncHandler(async (request, _response, next) => {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  if (!token) throw new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED');

  let payload: JwtPayload;
  try {
    const verified = jwt.verify(token, env.JWT_SECRET);
    if (typeof verified === 'string' || !verified.sub) throw new Error('Invalid token payload');
    payload = verified;
  } catch {
    throw new AppError('Token inválido ou expirado.', 401, 'UNAUTHORIZED');
  }

  // Recarregar identidade e papel permite revogar acesso sem esperar o JWT expirar.
  const user = await User.findOne({ _id: payload.sub, deletedAt: null });
  if (!user || !user.emailVerified) throw new AppError('Conta indisponível.', 401, 'UNAUTHORIZED');

  request.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    lastPasswordChange: user.lastPasswordChange,
    mustChangePassword: user.mustChangePassword,
  };
  next();
});