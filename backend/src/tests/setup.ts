import { vi } from 'vitest';
import { mailbox } from './mailbox.js';

// Precisa rodar antes de importar src/config/env.ts, que encerra o processo se a configuração for inválida.
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3999';
process.env['MONGO_URI'] = 'mongodb://127.0.0.1:27017/unused';
process.env['JWT_SECRET'] = 'test-secret-with-at-least-32-characters-long';
process.env['CORS_ORIGIN'] = 'http://localhost:8081';
process.env['API_PUBLIC_URL'] = 'http://localhost:3999';
process.env['LOG_LEVEL'] = 'silent';
for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'OTEL_EXPORTER_OTLP_ENDPOINT', 'TRUST_PROXY']) {
  delete process.env[key];
}

// Nenhum e-mail real é enviado: os links ficam na caixa em memória.
vi.mock('../utils/emailService.js', () => ({
  EmailService: class {
    async sendActionLink(to: string, subject: string, actionUrl: string): Promise<void> {
      mailbox.push({ to, subject, actionUrl });
    }
  },
}));
