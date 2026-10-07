import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { loggerOptions } from '../config/logger.js';

function capture() {
  const chunks: string[] = [];
  const stream = new Writable({ write(chunk, _encoding, callback) { chunks.push(String(chunk)); callback(); } });
  return { stream, output: () => chunks.join('') };
}

describe('Logger (redact)', () => {
  it('não grava senhas, tokens nem cabeçalhos de autenticação', () => {
    const { stream, output } = capture();
    const log = pino({ ...loggerOptions, level: 'info' }, stream);

    log.info({
      req: { headers: { authorization: 'Bearer segredo-jwt', cookie: 'sid=segredo-cookie' }, body: { password: 'SenhaSecreta#1', newPassword: 'NovaSecreta#2', token: 'tok-secreto' } },
      user: { password: 'SenhaSecreta#1', passwordHash: '$2b$12$hashsecreto', currentPassword: 'AtualSecreta#3' },
    }, 'teste');

    const text = output();
    for (const secret of ['segredo-jwt', 'segredo-cookie', 'SenhaSecreta#1', 'NovaSecreta#2', 'tok-secreto', 'hashsecreto', 'AtualSecreta#3']) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain('[REDACTED]');
  });
});
