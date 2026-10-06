import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { BCRYPT_ROUNDS, User } from '../models/User.js';

async function bootstrapAdmin(): Promise<void> {
  const name = env.BOOTSTRAP_ADMIN_NAME;
  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!name || !email || !password) {
    throw new Error('Defina BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD.');
  }

  await connectDatabase();
  const existingAdmin = await User.exists({ role: 'admin', deletedAt: null });
  if (existingAdmin) throw new Error('Já existe um administrador ativo.');

  await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    role: 'admin',
    emailVerified: true,
    mustChangePassword: true,
    lastPasswordChange: new Date(0),
  });
  process.stdout.write('Administrador inicial criado. Troque a senha no primeiro acesso.\n');
}

bootstrapAdmin()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Falha ao criar administrador.'}\n`);
    process.exitCode = 1;
  })
  .finally(async () => disconnectDatabase());