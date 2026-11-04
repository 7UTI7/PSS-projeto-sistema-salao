// Testes da conciliação Booksy × InfinitePay (GET /api/reports/reconciliation).
//
// A conciliação é agregada: ela não casa atendimento com movimento, compara os totais do
// período. O que estes testes fixam é justamente o que esse agregado pode afirmar — e o
// que ele se recusa a afirmar quando falta uma das duas origens.
import type { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { Transaction } from '../models/transaction.model.js';
import {
  CARD_SALES_CATEGORY,
  OTHER_INCOME_CATEGORY,
  PIX_INCOME_CATEGORY,
} from '../modules/imports/infinitepay.parser.js';
import { createUser, tokenFor, useTestDatabase } from './helpers.js';

useTestDatabase();

const PERIOD = { start: '2026-10-01T00:00:00.000Z', end: '2026-10-31T23:59:59.999Z' };

/** Atendimento vindo do Booksy: é a venda, e é a fonte do faturamento. */
function seedSale(
  createdBy: Types.ObjectId,
  options: { grossAmount: number; discountAmount?: number; day?: number },
) {
  return Transaction.create({
    type: 'receita',
    origin: 'booksy',
    description: 'Atendimento importado',
    grossAmount: options.grossAmount,
    discountAmount: options.discountAmount ?? 0,
    studioNetProfit: 0,
    netAmount: options.grossAmount,
    category: 'Cílios',
    professional: 'Nicolle',
    paymentMethod: 'nao_informado',
    occurredAt: new Date(Date.UTC(2026, 9, options.day ?? 10, 12, 0)),
    createdBy,
  });
}

/** Movimento vindo do extrato: é o dinheiro que entrou na conta. */
function seedReceipt(
  createdBy: Types.ObjectId,
  options: { grossAmount: number; category: string; day?: number },
) {
  return Transaction.create({
    type: 'receita',
    origin: 'infinitepay',
    description: 'Movimento importado',
    grossAmount: options.grossAmount,
    studioNetProfit: options.grossAmount,
    netAmount: options.grossAmount,
    category: options.category,
    professional: 'Nicolle',
    paymentMethod: 'pix',
    occurredAt: new Date(Date.UTC(2026, 9, options.day ?? 10, 14, 0)),
    settledAt: new Date(Date.UTC(2026, 9, options.day ?? 10, 14, 0)),
    status: 'liquidada',
    createdBy,
  });
}

async function reconcile() {
  const admin = await createUser({ role: 'admin' });
  return { admin, call: () => request(app).get('/api/reports/reconciliation').set('Authorization', `Bearer ${tokenFor(admin)}`).query(PERIOD) };
}

describe('GET /api/reports/reconciliation', () => {
  it('deduz a taxa da diferença entre o vendido e o recebido', async () => {
    const { admin, call } = await reconcile();
    await seedSale(admin._id, { grossAmount: 180 });
    await seedSale(admin._id, { grossAmount: 30 });
    await seedReceipt(admin._id, { grossAmount: 40, category: PIX_INCOME_CATEGORY });
    await seedReceipt(admin._id, { grossAmount: 149, category: CARD_SALES_CATEGORY });

    const response = await call();
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      vendasBrutas: 210,
      descontos: 0,
      vendasLiquidas: 210,
      qtdServicos: 2,
      recebidoPix: 40,
      recebidoCartao: 149,
      outrasEntradas: 0,
      liquidoReceber: 189,
      taxas: 21,
      taxaMediaEfetiva: 0.1,
      totalDivergencias: 21,
    });
    expect(response.body.data.divergencias).toHaveLength(1);
    expect(response.body.data.divergencias[0]).toMatchObject({ tipo: 'residuo', valor: 21 });
  });

  it('desconta o atendimento cortesia do que deveria ter entrado', async () => {
    const { admin, call } = await reconcile();
    // Atendimento 100% descontado: foi prestado, mas não gera dinheiro a receber.
    await seedSale(admin._id, { grossAmount: 180, discountAmount: 180 });
    await seedSale(admin._id, { grossAmount: 100 });
    await seedReceipt(admin._id, { grossAmount: 100, category: CARD_SALES_CATEGORY });

    const { data } = (await call()).body;
    expect(data.vendasBrutas).toBe(280);
    expect(data.descontos).toBe(180);
    expect(data.vendasLiquidas).toBe(100);
    expect(data.taxas).toBe(0);
    expect(data.divergencias).toHaveLength(0);
  });

  it('não calcula taxa quando só o Booksy foi importado', async () => {
    const { admin, call } = await reconcile();
    await seedSale(admin._id, { grossAmount: 210 });

    const { data } = (await call()).body;
    expect(data.taxas).toBeNull();
    expect(data.taxaMediaEfetiva).toBeNull();
    expect(data.liquidoReceber).toBe(0);
    expect(data.divergencias).toHaveLength(1);
    expect(data.divergencias[0]).toMatchObject({ tipo: 'sem_infinitepay', valor: 210 });
    expect(data.totalDivergencias).toBe(210);
  });

  it('não calcula taxa quando só o extrato foi importado', async () => {
    const { admin, call } = await reconcile();
    await seedReceipt(admin._id, { grossAmount: 189, category: CARD_SALES_CATEGORY });

    const { data } = (await call()).body;
    expect(data.taxas).toBeNull();
    expect(data.vendasBrutas).toBe(0);
    expect(data.divergencias).toHaveLength(1);
    expect(data.divergencias[0]).toMatchObject({ tipo: 'sem_booksy', valor: 189 });
  });

  it('separa a entrada que não é venda da comparação', async () => {
    const { admin, call } = await reconcile();
    await seedSale(admin._id, { grossAmount: 100 });
    await seedReceipt(admin._id, { grossAmount: 90, category: CARD_SALES_CATEGORY });
    await seedReceipt(admin._id, { grossAmount: 500, category: OTHER_INCOME_CATEGORY });

    const { data } = (await call()).body;
    expect(data.outrasEntradas).toBe(500);
    // O aporte de 500 não entra no recebido: senão pareceria que entrou mais do que vendeu.
    expect(data.liquidoReceber).toBe(90);
    expect(data.taxas).toBe(10);
    expect(data.divergencias.map((item: { tipo: string }) => item.tipo)).toEqual([
      'entrada_fora_de_venda',
      'residuo',
    ]);
  });

  it('aponta quando entrou mais dinheiro do que foi vendido', async () => {
    const { admin, call } = await reconcile();
    await seedSale(admin._id, { grossAmount: 100 });
    await seedReceipt(admin._id, { grossAmount: 250, category: CARD_SALES_CATEGORY });

    const { data } = (await call()).body;
    expect(data.taxas).toBe(-150);
    expect(data.divergencias).toHaveLength(1);
    expect(data.divergencias[0]).toMatchObject({ tipo: 'recebido_acima_do_vendido', valor: 150 });
  });

  it('devolve zeros sem divergência num período sem importação', async () => {
    const { call } = await reconcile();

    const response = await call();
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      vendasBrutas: 0,
      qtdServicos: 0,
      liquidoReceber: 0,
      taxas: null,
      taxaMediaEfetiva: null,
      divergencias: [],
      totalDivergencias: 0,
    });
  });

  it('ignora lançamento de outro período, cancelado ou apagado', async () => {
    const { admin, call } = await reconcile();
    await seedSale(admin._id, { grossAmount: 100 });
    await seedReceipt(admin._id, { grossAmount: 100, category: CARD_SALES_CATEGORY });
    // Setembro: fora da janela consultada.
    await Transaction.create({
      type: 'receita',
      origin: 'booksy',
      description: 'Atendimento de setembro',
      grossAmount: 999,
      studioNetProfit: 0,
      netAmount: 999,
      category: 'Cílios',
      professional: 'Nicolle',
      paymentMethod: 'nao_informado',
      occurredAt: new Date(Date.UTC(2026, 8, 15, 12, 0)),
      createdBy: admin._id,
    });
    const cancelled = await seedSale(admin._id, { grossAmount: 500, day: 11 });
    await Transaction.updateOne({ _id: cancelled._id }, { $set: { status: 'cancelada' } });
    const removed = await seedSale(admin._id, { grossAmount: 700, day: 12 });
    await Transaction.updateOne({ _id: removed._id }, { $set: { deletedAt: new Date() } });

    const { data } = (await call()).body;
    expect(data.vendasBrutas).toBe(100);
    expect(data.qtdServicos).toBe(1);
    expect(data.taxas).toBe(0);
  });

  it('nega a conciliação à colaboradora', async () => {
    const colaboradora = await createUser({ role: 'colaborador' });
    await request(app)
      .get('/api/reports/reconciliation')
      .set('Authorization', `Bearer ${tokenFor(colaboradora)}`)
      .query(PERIOD)
      .expect(403);
  });

  it('exige start e end como datas ISO', async () => {
    const admin = await createUser({ role: 'admin' });
    await request(app)
      .get('/api/reports/reconciliation')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .query({ start: '2026-10-01', end: '2026-10-31' })
      .expect(400);
  });
});
