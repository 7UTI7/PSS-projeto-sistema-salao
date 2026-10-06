import type { UserRole } from '../models/User.js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  lastPasswordChange: Date;
  mustChangePassword: boolean;
}