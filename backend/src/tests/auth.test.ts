import bcrypt from 'bcrypt';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { User } from '../models/User.js';
import { createUser, daysAgo, STRONG_PASSWORD, tokenFor, useTestDatabase } from './helpers.js';
import { mailbox, tokenFromLastEmail } from './mailbox.js';

useTestDatabase();

describe('Cadastro', () => {
  it('armazena a senha com hash bcrypt (12 rounds)', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'QA', email: 'qa@example.com', password: STRONG_PASSWORD })
      .expect(202);

    const user = await User.findOne({ email: 'qa@example.com' }).select('+passwordHash');
    expect(user?.passwordHash).not.toBe(STRONG_PASSWORD);
    expect(user?.passwordHash.startsWith('$2b$12$')).toBe(true);
    expect(await bcrypt.compare(STRONG_PASSWORD, user?.passwordHash ?? '')).toBe(true);
    expect(mailbox).toHaveLength(1);
  });

  it('retorna a mesma resposta 202 para e-mail já existente, sem novo e-mail', async () => {
    await createUser({ email: 'dup@example.com' });
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'QA', email: 'dup@example.com', password: STRONG_PASSWORD })
      .expect(202);

    expect(response.body.message).toBe('Se o cadastro for válido, enviaremos a confirmação por e-mail.');
    expect(mailbox).toHaveLength(0);
  });
});

describe('Login', () => {
  it('retorna 200 e JWT com credenciais corretas', async () => {
    await createUser({ email: 'ok@example.com' });
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ok@example.com', password: STRONG_PASSWORD })
      .expect(200);
    expect(response.body.data.token.split('.')).toHaveLength(3);
  });

  it('retorna 401 genérico para senha errada e para e-mail inexistente', async () => {
    await createUser({ email: 'real@example.com' });
    const wrong = await request(app).post('/api/auth/login').send({ email: 'real@example.com', password: 'SenhaErrada#2026' }).expect(401);
    const missing = await request(app).post('/api/auth/login').send({ email: 'nao@example.com', password: 'SenhaErrada#2026' }).expect(401);
    expect(wrong.body.message).toBe(missing.body.message);
  });
});

describe('Rotas protegidas', () => {
  it('retorna 401 sem token', async () => {
    await request(app).get('/api/transactions').expect(401);
    await request(app).get('/api/reports/dre').expect(401);
  });

  it('retorna 401 com token inválido ou adulterado', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    await request(app).get('/api/transactions').set('Authorization', 'Bearer lixo').expect(401);
    await request(app).get('/api/transactions').set('Authorization', `Bearer ${token.slice(0, -3)}abc`).expect(401);
  });

  it('retorna 403 quando mustChangePassword é true', async () => {
    const admin = await createUser({ role: 'admin', mustChangePassword: true });
    const response = await request(app).get('/api/reports/dre').set('Authorization', `Bearer ${tokenFor(admin)}`).expect(403);
    expect(response.body.message).toBe('Troca de senha obrigatória.');
  });
});

describe('Esqueci a senha e redefinição', () => {
  it('retorna 202 genérico para e-mail inexistente, sem enviar e-mail', async () => {
    const response = await request(app).post('/api/auth/forgot-password').send({ email: 'ninguem@example.com' }).expect(202);
    expect(response.body.message).toBe('Se a conta existir, enviaremos instruções de redefinição.');
    expect(mailbox).toHaveLength(0);
  });

  it('redefine com token válido e rejeita a reutilização', async () => {
    await createUser({ email: 'reset@example.com' });
    await request(app).post('/api/auth/forgot-password').send({ email: 'reset@example.com' }).expect(202);
    const token = tokenFromLastEmail();
    const newPassword = 'NovaSenhaForte#2027';

    await request(app).post('/api/auth/reset-password').send({ token, password: newPassword }).expect(200);
    const user = await User.findOne({ email: 'reset@example.com' }).select('+passwordHash');
    expect(await bcrypt.compare(newPassword, user?.passwordHash ?? '')).toBe(true);

    await request(app).post('/api/auth/reset-password').send({ token, password: 'OutraSenha#2028x' }).expect(400);
  });

  it('rejeita token expirado (15 minutos)', async () => {
    await createUser({ email: 'exp@example.com' });
    await request(app).post('/api/auth/forgot-password').send({ email: 'exp@example.com' }).expect(202);
    const token = tokenFromLastEmail();
    await User.updateOne({ email: 'exp@example.com' }, { passwordResetExpiresAt: new Date(Date.now() - 1000) });

    await request(app).post('/api/auth/reset-password').send({ token, password: 'NovaSenhaForte#2027' }).expect(400);
  });
});

describe('Confirmação de e-mail', () => {
  it('aceita o token uma vez e rejeita na segunda', async () => {
    await request(app).post('/api/auth/register').send({ name: 'QA', email: 'conf@example.com', password: STRONG_PASSWORD }).expect(202);
    const token = tokenFromLastEmail();

    await request(app).get('/api/auth/verify-email').query({ token }).expect(200);
    await request(app).get('/api/auth/verify-email').query({ token }).expect(400);
    expect((await User.findOne({ email: 'conf@example.com' }))?.emailVerified).toBe(true);
  });
});

describe('Política de 90 dias', () => {
  it('bloqueia rotas protegidas quando a senha tem mais de 90 dias', async () => {
    const user = await createUser({ lastPasswordChange: daysAgo(91) });
    const response = await request(app).get('/api/transactions').set('Authorization', `Bearer ${tokenFor(user)}`).expect(403);
    expect(response.body.message).toBe('Troca de senha obrigatória.');
  });

  it('libera após trocar a senha', async () => {
    const user = await createUser({ lastPasswordChange: daysAgo(91) });
    const auth = { Authorization: `Bearer ${tokenFor(user)}` };

    await request(app).post('/api/auth/change-password').set(auth)
      .send({ currentPassword: STRONG_PASSWORD, newPassword: 'NovaSenhaForte#2027' }).expect(200);
    await request(app).get('/api/transactions').set(auth).expect(200);
  });

  it('mantém acesso com senha de 89 dias', async () => {
    const user = await createUser({ lastPasswordChange: daysAgo(89) });
    await request(app).get('/api/transactions').set('Authorization', `Bearer ${tokenFor(user)}`).expect(200);
  });
});
