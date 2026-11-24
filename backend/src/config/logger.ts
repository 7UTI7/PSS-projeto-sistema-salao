// Logger Pino estruturado, com redação de dados sensíveis.
import pino, { type LoggerOptions } from 'pino';
import { env } from './env.js';

export const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL ?? (env.NODE_ENV === 'development' ? 'debug' : 'info'),
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'verificationToken',
      'resetToken',
      'authorization',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.newPassword',
      'req.body.currentPassword',
      'req.body.token',
      '*.password',
      '*.passwordHash',
      '*.newPassword',
      '*.currentPassword',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.verificationToken',
      '*.resetToken',
    ],
    censor: '[REDACTED]',
  },
};

function createLogger(): pino.Logger {
  if (!env.LOG_FILE) {
    return pino({
      ...loggerOptions,
      ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    });
  }

  // Com LOG_FILE, cada linha vai para o stdout e para o arquivo. O logrotate renomeia o arquivo
  // e envia SIGHUP; aqui o arquivo é reaberto, sem reiniciar a API nem perder linhas.
  const file = pino.destination({ dest: env.LOG_FILE, mkdir: true, sync: false });
  process.on('SIGHUP', () => file.reopen());
  return pino(loggerOptions, pino.multistream([{ stream: process.stdout }, { stream: file }]));
}

export const logger = createLogger();