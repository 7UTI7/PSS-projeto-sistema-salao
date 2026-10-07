import request from 'supertest';
import { describe, it } from 'vitest';
import { app } from '../app.js';
import { createUser, useTestDatabase } from './helpers.js';

useTestDatabase();

// Este arquivo roda isolado (módulos próprios do vitest), então os contadores em memória do
// express-rate-limit não vazam para os demais testes.
describe('Rate limit', () => {
  it('limita tentativas de login (429) sem bloquear o fluxo de reset', async () => {
    await createUser({ email: 'rl@example.com' });
    const attempt = () => request(app).post('/api/auth/login').send({ email: 'rl@example.com', password: 'SenhaErrada#2026' });

    for (let index = 0; index < 10; index += 1) {
      await attempt().expect(401);
    }
    await attempt().expect(429);

    // Bucket de redefinição é independente do bucket de login.
    await request(app).post('/api/auth/forgot-password').send({ email: 'rl@example.com' }).expect(202);
  });

  it('usa o IP de X-Forwarded-For apenas quando TRUST_PROXY está ativo (desligado nos testes)', async () => {
    // Sem trust proxy, o cabeçalho é ignorado: não dá para escapar do limite forjando o IP.
    await request(app).post('/api/auth/login').set('X-Forwarded-For', '203.0.113.9')
      .send({ email: 'rl@example.com', password: 'SenhaErrada#2026' }).expect(429);
  });
});
