// Estende o Request do Express com o usuário autenticado (request.user).
import type { AuthenticatedUser } from '../../modules/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};