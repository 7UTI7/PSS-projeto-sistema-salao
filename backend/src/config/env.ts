import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default('*'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().min(2).max(120).optional(),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(72)
    .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, 'Senha excede 72 bytes suportados pelo bcrypt.')
    .optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  process.stderr.write(`Configuração inválida:\n${issues.join('\n')}\n`);
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.CORS_ORIGIN === '*') {
  process.stderr.write('Em produção, CORS_ORIGIN deve listar origens explícitas.\n');
  process.exit(1);
}

const smtpSettings = [
  parsed.data.SMTP_HOST,
  parsed.data.SMTP_PORT,
  parsed.data.SMTP_USER,
  parsed.data.SMTP_PASSWORD,
  parsed.data.SMTP_FROM,
];

if (smtpSettings.some(Boolean) && smtpSettings.some((setting) => !setting)) {
  process.stderr.write('Configuração SMTP incompleta: preencha todas as variáveis SMTP.\n');
  process.exit(1);
}

const adminBootstrapSettings = [
  parsed.data.BOOTSTRAP_ADMIN_NAME,
  parsed.data.BOOTSTRAP_ADMIN_EMAIL,
  parsed.data.BOOTSTRAP_ADMIN_PASSWORD,
];

if (adminBootstrapSettings.some(Boolean) && adminBootstrapSettings.some((setting) => !setting)) {
  process.stderr.write('Bootstrap do admin incompleto: preencha todas as variáveis BOOTSTRAP_ADMIN.\n');
  process.exit(1);
}

export const env = parsed.data;