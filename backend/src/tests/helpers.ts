import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { BCRYPT_ROUNDS, User, type UserRole } from '../models/User.js';
import { mailbox } from './mailbox.js';

export const STRONG_PASSWORD = 'SenhaForte#2026';

/** Banco MongoDB em memória, isolado de qualquer dado real. */
export function useTestDatabase(): void {
  let server: MongoMemoryServer | undefined;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri(), { dbName: 'test' });
    await User.init();
  }, 120_000);

  beforeEach(async () => {
    mailbox.length = 0;
    await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });
}

export async function createUser(options: {
  email?: string;
  role?: UserRole;
  password?: string;
  emailVerified?: boolean;
  mustChangePassword?: boolean;
  lastPasswordChange?: Date;
} = {}) {
  const user = await User.create({
    name: 'Usuária QA',
    email: options.email ?? `qa-${Math.random().toString(36).slice(2)}@example.com`,
    passwordHash: await bcrypt.hash(options.password ?? STRONG_PASSWORD, BCRYPT_ROUNDS),
    role: options.role ?? 'colaborador',
    emailVerified: options.emailVerified ?? true,
    mustChangePassword: options.mustChangePassword ?? false,
    lastPasswordChange: options.lastPasswordChange ?? new Date(),
  });
  return user;
}

/** Gera um JWT válido sem passar pelo endpoint de login (que tem rate limit). */
export function tokenFor(user: { _id: { toString(): string }; role: UserRole }): string {
  return jwt.sign({ role: user.role }, process.env['JWT_SECRET'] as string, { subject: user._id.toString(), expiresIn: '1h' });
}

export const daysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
