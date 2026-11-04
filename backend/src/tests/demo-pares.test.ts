// Os pares de demonstração de Documents/, conferidos pelo caminho real do servidor.
//
// Eles existem para a dona mostrar o sistema funcionando, então o que importa provar é
// que a submissão pela rota produz exatamente os números combinados — não a aritmética
// do script que os gerou.
//
// Setembro fecha sozinho (Cenário A). Outubro divergente por R$ 200,00 (Cenário B), que
// o lançamento manual de "pago em dinheiro" zera.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { Transaction } from '../models/transaction.model.js';
import { createUser, tokenFor, useTestDatabase } from './helpers.js';

useTestDatabase();

const DOCUMENTS = path.resolve(import.meta.dirname, '../../../Documents');

let token = '';

beforeEach(async () => {
  token = tokenFor(await createUser({ role: 'admin' }));
});

function submit(mes: 'setembro' | 'outubro') {
  const booksy = path.join(DOCUMENTS, `DEMO_booksy_${mes}2026.xlsx`);
  const extrato = path.join(DOCUMENTS, `DEMO_infinitepay_${mes}2026.csv`);
  return request(app)
    .post('/api/audits')
    .set('Authorization', `Bearer ${token}`)
    .attach('booksy', readFileSync(booksy), { filename: path.basename(booksy) })
    // O MIME que o seletor do Android informa para um .csv.
    .attach('infinitepay', readFileSync(extrato), {
      filename: path.basename(extrato),
      contentType: 'text/comma-separated-values',
    });
}

function auditOf(period: string) {
  return request(app)
    .get('/api/audits')
    .query({ period })
    .set('Authorization', `Bearer ${token}`);
}

describe('Par de setembro/2026: fecha sozinho', () => {
  it('as duas fontes batem e a auditoria nasce aprovada', async () => {
    const response = await submit('setembro');
    expect(response.status).toBe(201);

    // 21 agendamentos, 1 cancelado -> 20 atendimentos.
    expect(response.body.data.booksy.importedCount).toBe(20);
    // 20 entradas + 2 retiradas.
    expect(response.body.data.infinitepay.importedCount).toBe(22);

    const audit = response.body.data.audits.find(
      (item: { period: string }) => item.period === '2026-09',
    );
    expect(audit.outcome).toBe('aprovada');
    expect(audit.faturamentoBooksy).toBeCloseTo(1405, 2);
    expect(audit.entradasInfinitepay).toBeCloseTo(1405, 2);
    expect(audit.diferenca).toBeCloseTo(0, 2);
  }, 120_000);

  it('mostra os três saldos', async () => {
    await submit('setembro');
    const audit = await auditOf('2026-09');

    expect(audit.body.data.approvedAt).toBeTruthy();
    expect(audit.body.data.saldoBruto).toBeCloseTo(1405, 2);
    expect(audit.body.data.saldoRetirado).toBeCloseTo(700, 2);
    expect(audit.body.data.saldoLiquido).toBeCloseTo(705, 2);
  }, 120_000);
});

describe('Par de outubro/2026: divergente por R$ 200,00', () => {
  it('barra a diferença', async () => {
    const response = await submit('outubro');
    expect(response.status).toBe(201);

    // 30 agendamentos, 2 cancelados -> 28 atendimentos.
    expect(response.body.data.booksy.importedCount).toBe(28);
    // 26 entradas + 2 retiradas: dois atendimentos não aparecem no extrato.
    expect(response.body.data.infinitepay.importedCount).toBe(28);

    const audit = response.body.data.audits.find(
      (item: { period: string }) => item.period === '2026-10',
    );
    expect(audit.outcome).toBe('divergente');
    expect(audit.faturamentoBooksy).toBeCloseTo(2160, 2);
    expect(audit.entradasInfinitepay).toBeCloseTo(1960, 2);
    expect(audit.diferenca).toBeCloseTo(200, 2);
  }, 120_000);

  it('o lançamento de "pago em dinheiro" fecha a conta', async () => {
    await submit('outubro');

    const entry = await request(app)
      .post('/api/audits/2026-10/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, reason: 'dinheiro', description: 'Dois atendimentos pagos em espécie' });

    expect(entry.status).toBe(201);
    expect(entry.body.data.outcome).toBe('aprovada');
    expect(entry.body.data.diferenca).toBeCloseTo(0, 2);

    const audit = await auditOf('2026-10');
    // Os R$ 200 em espécie entram no bruto: é dinheiro que ela tem na mão.
    expect(audit.body.data.saldoBruto).toBeCloseTo(2160, 2);
    expect(audit.body.data.saldoRetirado).toBeCloseTo(400, 2);
    expect(audit.body.data.saldoLiquido).toBeCloseTo(1760, 2);
  }, 120_000);

  it('as saídas do extrato ficam fora do DRE', async () => {
    await submit('outubro');

    const retiradas = await Transaction.find({
      origin: 'infinitepay',
      countsInDre: false,
      deletedAt: null,
    }).lean();
    expect(retiradas).toHaveLength(2);
    expect(retiradas.reduce((total, row) => total + row.grossAmount, 0)).toBeCloseTo(400, 2);

    const dre = await request(app)
      .get('/api/reports/dre')
      .query({ start: '2026-10-01T00:00:00.000Z', end: '2026-10-31T23:59:59.999Z' })
      .set('Authorization', `Bearer ${token}`);
    expect(dre.body.data.despesas).toBe(0);
    // Faturamento é só o do Booksy: as entradas do extrato são a mesma venda.
    expect(dre.body.data.faturamentoBruto).toBeCloseTo(2160, 2);
  }, 120_000);
});

describe('Os dois pares juntos', () => {
  it('ficam em meses separados, cada um com o seu desfecho', async () => {
    await submit('setembro');
    await submit('outubro');

    const setembro = await auditOf('2026-09');
    const outubro = await auditOf('2026-10');

    expect(setembro.body.data.outcome).toBe('aprovada');
    expect(outubro.body.data.outcome).toBe('divergente');

    // Um mês não contamina o outro: é o que a tela de histórico e o filtro mostram.
    expect(setembro.body.data.saldoBruto).toBeCloseTo(1405, 2);
    expect(outubro.body.data.saldoBruto).toBeCloseTo(1960, 2);
  }, 120_000);
});
