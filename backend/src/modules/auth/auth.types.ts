// Tipos do usuário autenticado e do payload do JWT.
import type { UserRole } from './user.model.js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  lastPasswordChange: Date;
  mustChangePassword: boolean;
}