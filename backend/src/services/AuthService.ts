import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { BCRYPT_ROUNDS, PASSWORD_MAX_AGE_DAYS, User, type UserRole } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { EmailService } from '../utils/emailService.js';

const TOKEN_TTL_MS = 15 * 60 * 1000;
const emailService = new EmailService();

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function passwordExpiryDate(): Date {
  return new Date(Date.now() - PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

function toPublicUser(user: { id: string; name: string; email: string; role: UserRole; mustChangePassword: boolean }): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export class AuthService {
  async listUsers(): Promise<Array<PublicUser & { emailVerified: boolean; createdAt: Date }>> {
    const users = await User.find({ deletedAt: null })
      .select('name email role emailVerified mustChangePassword createdAt')
      .sort({ createdAt: -1 })
      .lean();
    return users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    }));
  }

  async deactivateUser(actorId: string, targetId: string): Promise<void> {
    if (actorId === targetId) throw new AppError('Não é permitido desativar a própria conta.', 400, 'SELF_DEACTIVATION');

    const target = await User.findOne({ _id: targetId, deletedAt: null });
    if (!target) throw new AppError('Usuário não encontrado.', 404, 'NOT_FOUND');
    if (target.role === 'admin') {
      const activeAdmins = await User.countDocuments({ role: 'admin', deletedAt: null });
      if (activeAdmins <= 1) throw new AppError('O último administrador não pode ser desativado.', 409, 'LAST_ADMIN');
    }

    target.deletedAt = new Date();
    await target.save();
  }

  async register(input: { name: string; email: string; password: string }): Promise<void> {
    try {
      await this.createAccount({ ...input, role: 'colaborador', mustChangePassword: false });
    } catch (error: unknown) {
      if (error instanceof AppError && error.code === 'EMAIL_IN_USE') return;
      throw error;
    }
  }

  async createAccount(input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    mustChangePassword: boolean;
  }): Promise<void> {
    const existing = await User.exists({ email: input.email.toLowerCase() });
    if (existing) throw new AppError('Não foi possível criar a conta com este e-mail.', 409, 'EMAIL_IN_USE');

    const token = randomUUID();
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      role: input.role,
      mustChangePassword: input.mustChangePassword,
      emailVerified: false,
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      lastPasswordChange: new Date(),
    });

    await emailService.sendActionLink(
      user.email,
      'Confirme seu e-mail - Nicolle Neris Studio',
      `${env.API_PUBLIC_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
    );
  }

  async login(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null }).select('+passwordHash');
    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !passwordMatches || !user.emailVerified) {
      throw new AppError('E-mail ou senha inválidos.', 401, 'INVALID_CREDENTIALS');
    }

    const mustChangePassword = user.mustChangePassword || user.lastPasswordChange < passwordExpiryDate();
    const token = jwt.sign({ role: user.role }, env.JWT_SECRET, { subject: user.id, expiresIn: '8h' });
    return {
      token,
      user: toPublicUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword,
      }),
    };
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await User.findOne({
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpiresAt: { $gt: new Date() },
      deletedAt: null,
    }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');

    if (!user) throw new AppError('Token inválido ou expirado.', 400, 'INVALID_TOKEN');
    user.emailVerified = true;
    user.set('emailVerificationTokenHash', undefined);
    user.set('emailVerificationExpiresAt', undefined);
    await user.save();
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null });
    if (!user) return;

    const token = randomUUID();
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await user.save();

    try {
      await emailService.sendActionLink(
        user.email,
        'Redefinição de senha - Nicolle Neris Studio',
        `${env.API_PUBLIC_URL}/api/auth/reset-password?token=${encodeURIComponent(token)}`,
      );
    } catch (error: unknown) {
      logger.error({ err: error }, 'Falha ao enviar e-mail de redefinição');
      throw error;
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const user = await User.findOne({
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: { $gt: new Date() },
      deletedAt: null,
    }).select('+passwordResetTokenHash +passwordResetExpiresAt');

    if (!user) throw new AppError('Token inválido ou expirado.', 400, 'INVALID_TOKEN');
    user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.set('passwordResetTokenHash', undefined);
    user.set('passwordResetExpiresAt', undefined);
    user.lastPasswordChange = new Date();
    user.mustChangePassword = false;
    await user.save();
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findOne({ _id: userId, deletedAt: null }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError('Senha atual inválida.', 401, 'INVALID_CREDENTIALS');
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.lastPasswordChange = new Date();
    user.mustChangePassword = false;
    await user.save();
  }
}