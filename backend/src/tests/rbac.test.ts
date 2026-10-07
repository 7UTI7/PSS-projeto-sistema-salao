import type { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { Transaction } from '../models/Transaction.js';
import { createUser, tokenFor, useTestDatabase } from './helpers.js';

useTestDatabase();

function seedTransaction(professional: 'Nicolle' | 'Stefany', createdBy: Types.ObjectId) {
  return Transaction.create({
    type: 'receita',
    description: `Atendimento ${professional}`,
    grossAmount: 100,
    studioNetProfit: 50,
    netAmount: 100,
    category: 'Serviço',
    paymentMethod: 'pix',
    occurredAt: new Date(),
    professional,
    createdBy,
  });
}

describe('RBAC', () => {
  it('nega relatórios à colaboradora (403) e permite ao admin (200)', async () => {
    const colaboradora = await createUser({ role: 'colaborador' });
    const admin = await createUser({ role: 'admin' });

    await request(app).get('/api/reports/dre').set('Authorization', `Bearer ${tokenFor(colaboradora)}`).expect(403);
    await request(app).get('/api/reports/cash-flow').set('Authorization', `Bearer ${tokenFor(colaboradora)}`).expect(403);
    await request(app).get('/api/reports/dre').set('Authorization', `Bearer ${tokenFor(admin)}`).query({ from: '2026-01-01', to: '2026-12-31' })
      .then((response) => expect(response.status).not.toBe(403));
  });

  it('nega gestão de usuários à colaboradora', async () => {
    const colaboradora = await createUser({ role: 'colaborador' });
    await request(app).get('/api/auth/users').set('Authorization', `Bearer ${tokenFor(colaboradora)}`).expect(403);
  });

  it('colaboradora vê só os próprios lançamentos; admin vê todos', async () => {
    const colaboradora = await createUser({ role: 'colaborador' });
    const admin = await createUser({ role: 'admin' });
    await seedTransaction('Stefany', colaboradora._id);
    await seedTransaction('Nicolle', admin._id);

    const own = await request(app).get('/api/transactions').set('Authorization', `Bearer ${tokenFor(colaboradora)}`).expect(200);
    expect(own.body.data).toHaveLength(1);
    expect(own.body.data[0].description).toBe('Atendimento Stefany');
    expect(own.body.data[0]).not.toHaveProperty('studioNetProfit');

    const adminList = await request(app).get('/api/transactions').set('Authorization', `Bearer ${tokenFor(admin)}`).expect(200);
    expect(adminList.body.data.map((item: { description: string }) => item.description).sort())
      .toEqual(['Atendimento Nicolle', 'Atendimento Stefany']);
  });

  it('colaboradora não registra despesas nem apaga lançamentos de outra profissional', async () => {
    const colaboradora = await createUser({ role: 'colaborador' });
    const admin = await createUser({ role: 'admin' });
    const alheia = await seedTransaction('Nicolle', admin._id);
    const auth = { Authorization: `Bearer ${tokenFor(colaboradora)}` };

    await request(app).post('/api/transactions').set(auth).send({
      type: 'despesa', description: 'Aluguel', grossAmount: 500, category: 'Fixo', costType: 'fixo',
      paymentMethod: 'pix', occurredAt: '2026-01-10',
    }).expect(403);
    await request(app).delete(`/api/transactions/${alheia.id}`).set(auth).expect(404);
  });
});
