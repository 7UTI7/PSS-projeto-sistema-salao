// Testes da política de senha forte (unidade e nas rotas que definem senha).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { User } from '../models/user.model.js';
import { passwordViolations } from '../shared/utils/password-policy.js';
import { createUser, STRONG_PASSWORD, tokenFor, useTestDatabase } from './helpers.js';
import { mailbox } from './mailbox.js';

useTestDatabase();

describe('passwordViolations', () => {
  it.each([
    ['curta', 'Ab#1'],
    ['sem maiúscula', 'senhafraca#2026'],
    ['sem minúscula', 'SENHAFRACA#2026'],
    ['sem número', 'SenhaFraca#Sem'],
    ['sem caractere especial', 'SenhaFraca2026'],
    ['só espaço como especial', 'Senha Fraca 2026'],
  ])('rejeita senha %s', (_case, password) => {
    expect(passwordViolations(password).length).toBeGreaterThan(0);
  });

  it('aceita senha com todas as classes, inclusive acentuada', () => {
    expect(passwordViolations(STRONG_PASSWORD)).toEqual([]);
    expect(passwordViolations('Ação#Segura2026')).toEqual([]);
  });

  it('rejeita senha acima de 72 bytes (limite do bcrypt)', () => {
    expect(passwordViolations(`Aa1#${'x'.repeat(69)}`)).toContain('A senha excede 72 bytes suportados pelo bcrypt.');
  });
});

describe('Rotas aplicam a política de senha forte', () => {
  it('cadastro com senha fraca retorna 400 com a regra violada e não cria conta', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'QA', email: 'fraca@example.com', password: 'senhafraca2026' })
      .expect(400);

    expect(response.body.message).toMatch(/maiúscula|especial/);
    expect(await User.exists({ email: 'fraca@example.com' })).toBeNull();
    expect(mailbox).toHaveLength(0);
  });

  it('troca de senha autenticada rejeita nova senha fraca', async () => {
    const user = await createUser({ email: 'troca@example.com' });
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ currentPassword: STRONG_PASSWORD, newPassword: 'SenhaSemEspecial2027' })
      .expect(400);
  });

  it('redefinição por token rejeita senha fraca', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: '7f1c6c84-6f4f-4c64-9a4e-2f4a0e1b9d10', password: 'semmaiuscula#2027' })
      .expect(400);
    expect(response.body.message).toBe('A senha deve conter pelo menos uma letra maiúscula.');
  });
});
