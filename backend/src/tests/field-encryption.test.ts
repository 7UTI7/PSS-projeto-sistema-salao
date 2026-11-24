// Testes da criptografia de campo: o nome do usuário fica cifrado no MongoDB.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { User } from '../models/user.model.js';
import { decryptField, encryptField } from '../shared/utils/field-encryption.js';
import { createUser, STRONG_PASSWORD, tokenFor, useTestDatabase } from './helpers.js';

useTestDatabase();

describe('encryptField / decryptField', () => {
  it('cifra com IV aleatório e decifra para o texto original', () => {
    const first = encryptField('Maria da Silva');
    const second = encryptField('Maria da Silva');
    expect(first).toMatch(/^enc:v1:/);
    expect(first).not.toBe(second);
    expect(decryptField(first)).toBe('Maria da Silva');
  });

  it('detecta adulteração do valor cifrado (tag GCM)', () => {
    const parts = encryptField('Maria da Silva').split(':');
    const data = Buffer.from(parts[4] ?? '', 'base64');
    data[0] = (data[0] ?? 0) ^ 0xff;
    parts[4] = data.toString('base64');
    expect(() => decryptField(parts.join(':'))).toThrow();
  });

  it('devolve como está um valor legado ainda em texto puro', () => {
    expect(decryptField('Nome Antigo')).toBe('Nome Antigo');
  });
});

describe('Coluna users.name criptografada', () => {
  it('grava o nome cifrado no banco e a API devolve o nome legível', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Cliente Sigilosa', email: 'sigilo@example.com', password: STRONG_PASSWORD })
      .expect(202);

    const raw = await User.collection.findOne({ email: 'sigilo@example.com' });
    expect(raw?.['name']).toMatch(/^enc:v1:/);
    expect(JSON.stringify(raw)).not.toContain('Cliente Sigilosa');

    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const list = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .expect(200);
    const names = (list.body.data as Array<{ name: string }>).map((user) => user.name);
    expect(names).toContain('Cliente Sigilosa');
  });
});
