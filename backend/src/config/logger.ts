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

export const logger = pino({
  ...loggerOptions,
  ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
});