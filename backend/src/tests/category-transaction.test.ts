// Testes do CRUD de categorias e da edição/liquidação de lançamentos.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { createUser, tokenFor, useTestDatabase } from './helpers.js';

useTestDatabase();

const payload = {
  type: 'receita', description: 'Corte', grossAmount: 100, category: 'Serviço',
  paymentMethod: 'pix', occurredAt: '2026-01-10',
};

describe('Categorias e edição de transações', () => {
  it('CRUD de categorias é restrito ao admin e rejeita lançamento fora do catálogo', async () => {
    const admin = await createUser({ role: 'admin' });
    const colab = await createUser({ role: 'colaborador' });
    const a = { Authorization: `Bearer ${tokenFor(admin)}` };
    const c = { Authorization: `Bearer ${tokenFor(colab)}` };

    await request(app).post('/api/categories').set(c).send({ name: 'X' }).expect(403);
    await request(app).post('/api/transactions').set(a).send(payload).expect(400);

    const created = await request(app).post('/api/categories').set(a).send({ name: 'Serviço', kind: 'receita' }).expect(201);
    await request(app).post('/api/categories').set(a).send({ name: 'serviço' }).expect(409);
    await request(app).put(`/api/categories/${created.body.data._id}`).set(a).send({ name: 'Serviço', kind: 'ambos' }).expect(200);
    await request(app).post('/api/transactions').set(a).send(payload).expect(201);
    await request(app).delete(`/api/categories/${created.body.data._id}`).set(a).expect(204);
    await request(app).post('/api/transactions').set(a).send(payload).expect(400);
  });

  it('PUT liquida a transação preenchendo settledAt e limpa ao voltar para pendente', async () => {
    const admin = await createUser({ role: 'admin' });
    const a = { Authorization: `Bearer ${tokenFor(admin)}` };
    await request(app).post('/api/categories').set(a).send({ name: 'Serviço' }).expect(201);
    const tx = await request(app).post('/api/transactions').set(a).send(payload).expect(201);
    expect(tx.body.data.settledAt).toBeUndefined();

    const settled = await request(app).put(`/api/transactions/${tx.body.data._id}`).set(a)
      .send({ ...payload, grossAmount: 200, status: 'liquidada' }).expect(200);
    expect(settled.body.data.settledAt).toBeTruthy();
    expect(settled.body.data.grossAmount).toBe(200);

    const back = await request(app).put(`/api/transactions/${tx.body.data._id}`).set(a)
      .send({ ...payload, status: 'pendente' }).expect(200);
    expect(back.body.data.settledAt).toBeUndefined();
    await request(app).put('/api/transactions/aaaaaaaaaaaaaaaaaaaaaaaa').set(a).send(payload).expect(404);
  });
});
