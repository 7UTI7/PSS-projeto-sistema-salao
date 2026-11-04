// A auditoria com um par de arquivos do MESMO mês.
//
// É o teste que faltava. O outro par de Documents/ cobre meses diferentes (Booksy em
// agosto, extrato em outubro), então com ele a auditoria só podia cair em "fonte
// ausente" — os Cenários A e B nunca apareciam com arquivo de verdade, só com fixture
// montada à mão.
//
// Este par é de outubro/2026 dos dois lados, e os dois formatos são os que o app recebe
// de fato: o relatório do Booksy em .xlsx e o extrato exportado como .csv.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { Transaction } from '../models/transaction.model.js';
import { createUser, tokenFor, useTestDatabase } from './helpers.js';

useTestDatabase();

const DOCUMENTS = path.resolve(import.meta.dirname, '../../../Documents');
const BOOKSY = path.join(DOCUMENTS, 'FICTICIO_relatorio_agendamentos_out2026.xlsx');
const EXTRATO = path.join(DOCUMENTS, 'FICTICIO_movimentacoes_banco_out2026.csv');

let token = '';

beforeEach(async () => {
  token = tokenFor(await createUser({ role: 'admin' }));
});

/** Manda os dois juntos, como a tela faz. */
function submit() {
  return request(app)
    .post('/api/audits')
    .set('Authorization', `Bearer ${token}`)
    .attach('booksy', readFileSync(BOOKSY), { filename: path.basename(BOOKSY) })
    .attach('infinitepay', readFileSync(EXTRATO), { filename: path.basename(EXTRATO) });
}

function auditOf(period: string) {
  return request(app)
    .get('/api/audits')
    .query({ period })
    .set('Authorization', `Bearer ${token}`);
}

describe('Par de outubro/2026, os dois formatos reais', () => {
  it('lê os dois arquivos e acusa a diferença (Cenário B)', async () => {
    const response = await submit();
    expect(response.status).toBe(201);

    // Booksy: 33 agendamentos, 4 cancelados -> 29 atendimentos, R$ 2.000,00.
    // O arquivo declara esse total na própria linha "Total".
    expect(response.body.data.booksy.importedCount).toBe(29);

    // Extrato: 25 movimentos — 23 entradas (Pix recebido + depósito de vendas) somando
    // R$ 1.800,00, e 2 saídas para a conta do salão somando R$ 400,00.
    expect(response.body.data.infinitepay.importedCount).toBe(25);

    const audit = response.body.data.audits.find(
      (item: { period: string }) => item.period === '2026-10',
    );
    expect(audit.outcome).toBe('divergente');
    expect(audit.faturamentoBooksy).toBeCloseTo(2000, 2);
    expect(audit.entradasInfinitepay).toBeCloseTo(1800, 2);
    expect(audit.diferenca).toBeCloseTo(200, 2);
  }, 120_000);

  it('os três saldos saem do extrato', async () => {
    await submit();
    const audit = await auditOf('2026-10');

    expect(audit.body.data.saldoBruto).toBeCloseTo(1800, 2);
    expect(audit.body.data.saldoRetirado).toBeCloseTo(400, 2);
    expect(audit.body.data.saldoLiquido).toBeCloseTo(1400, 2);
  }, 120_000);

  it('as duas saídas do CSV viram retirada, não despesa', async () => {
    await submit();

    // No CSV não há cabeçalho com o titular da conta, então toda saída conta como
    // retirada — decisão da dona, registrada no parser.
    const retiradas = await Transaction.find({
      origin: 'infinitepay',
      countsInDre: false,
      deletedAt: null,
    }).lean();

    expect(retiradas).toHaveLength(2);
    expect(retiradas.reduce((total, row) => total + row.grossAmount, 0)).toBeCloseTo(400, 2);

    // Fora do DRE: lançá-las como despesa comeria o lucro do mês.
    const dre = await request(app)
      .get('/api/reports/dre')
      .query({ start: '2026-10-01T00:00:00.000Z', end: '2026-10-31T23:59:59.999Z' })
      .set('Authorization', `Bearer ${token}`);
    expect(dre.body.data.despesas).toBe(0);
    // O faturamento é só o do Booksy: as entradas do extrato são a mesma venda.
    expect(dre.body.data.faturamentoBruto).toBeCloseTo(2000, 2);
  }, 120_000);

  it('o lançamento manual fecha a conta (Cenário B -> A)', async () => {
    await submit();

    const entry = await request(app)
      .post('/api/audits/2026-10/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, reason: 'dinheiro', description: 'Atendimentos pagos em espécie' });

    expect(entry.status).toBe(201);
    expect(entry.body.data.outcome).toBe('aprovada');
    expect(entry.body.data.diferenca).toBeCloseTo(0, 2);

    const audit = await auditOf('2026-10');
    expect(audit.body.data.approvedAt).toBeTruthy();
    // Os R$ 200 em dinheiro entram no Saldo Bruto: é dinheiro que ela tem.
    expect(audit.body.data.saldoBruto).toBeCloseTo(2000, 2);
    expect(audit.body.data.saldoLiquido).toBeCloseTo(1600, 2);

    // Mas não no DRE: o atendimento já está no faturamento do Booksy.
    const dre = await request(app)
      .get('/api/reports/dre')
      .query({ start: '2026-10-01T00:00:00.000Z', end: '2026-10-31T23:59:59.999Z' })
      .set('Authorization', `Bearer ${token}`);
    expect(dre.body.data.faturamentoBruto).toBeCloseTo(2000, 2);
  }, 120_000);

  it('aceita o CSV mesmo com o MIME antigo que o Android manda', async () => {
    // O seletor do Android informa "text/comma-separated-values"; o servidor recusava, e
    // era o erro que ela via na tela ao escolher um arquivo que o app deixou escolher.
    const response = await request(app)
      .post('/api/audits')
      .set('Authorization', `Bearer ${token}`)
      .attach('booksy', readFileSync(BOOKSY), { filename: path.basename(BOOKSY) })
      .attach('infinitepay', readFileSync(EXTRATO), {
        filename: path.basename(EXTRATO),
        contentType: 'text/comma-separated-values',
      });

    expect(response.status).toBe(201);
  }, 120_000);
});
