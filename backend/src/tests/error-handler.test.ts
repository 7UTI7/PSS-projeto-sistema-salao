// Erros de cliente do body-parser devem responder 4xx, nunca 500 (achado do Wapiti).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app.js';

describe('Tratamento de erros de requisição malformada', () => {
  it('corpo urlencoded acima do limite retorna 413 sem detalhes internos', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .type('form')
      .send(`token=${'a'.repeat(4096)}&password=x`)
      .expect(413);
    expect(response.body).toEqual({ status: 'error', message: 'Conteúdo da requisição excede o tamanho permitido.' });
  });

  it('JSON malformado retorna 400 e não 500', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.com", "password": ')
      .expect(400);
    expect(JSON.stringify(response.body)).not.toMatch(/stack|SyntaxError/);
  });
});
