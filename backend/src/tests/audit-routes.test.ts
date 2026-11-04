// Rotas da auditoria: os dois relatórios no mesmo envio, o estado do mês e o ajuste.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { Audit } from '../models/audit.model.js';
import { Transaction } from '../models/transaction.model.js';
import { createUser, tokenFor, useTestDatabase } from './helpers.js';

useTestDatabase();

async function adminToken(): Promise<string> {
  return tokenFor(await createUser({ role: 'admin' }));
}

/**
 * Relatório do Booksy em CSV, no formato que o parser lê. Um atendimento por linha.
 * O total líquido é `price − discount`, e é ele que a auditoria compara.
 */
function booksyCsv(rows: readonly { service: string; price: number; discount?: number; day: number }[]): string {
  return [
    'Data e hora,ID da Reserva,Categoria principal,Serviço,Funcionário,Valor dos serviços,Desconto,Status',
    ...rows.map((row, index) => [
      `${String(row.day).padStart(2, '0')}/10/2026 10:00`,
      String(index + 1),
      'Unhas',
      row.service,
      'Nicolle Neris',
      row.price.toFixed(2),
      (row.discount ?? 0).toFixed(2),
      'Concluída',
    ].join(',')),
  ].join('\n');
}

/** Extrato da InfinitePay em CSV, com o bloco de resumo coerente com as linhas. */
function statementCsv(rows: readonly { day: number; time: string; name: string; amount: number }[]): string {
  const credits = rows.filter((r) => r.amount > 0).reduce((t, r) => t + r.amount, 0);
  const debits = rows.filter((r) => r.amount < 0).reduce((t, r) => t + r.amount, 0);
  const signed = (value: number, space = '') =>
    `${value < 0 ? '-' : '+'}${space}${Math.abs(value).toFixed(2).replace('.', ',')}`;

  return [
    '60.441.829 NICOLLE NERIS RODRIGUES - CNPJ: 60.441.829/0001-51',
    'Saldo inicial;+ 0,00',
    `Total de entradas;${signed(credits, ' ')}`,
    `Total de saidas;${signed(debits, ' ')}`,
    `Saldo final do periodo;${signed(credits + debits, ' ')}`,
    'Data;Hora;Tipo de transacao;Nome;Detalhe;Valor (R$)',
    ...rows.map((row) => [
      `${String(row.day).padStart(2, '0')} Out, 2026`,
      row.time,
      'Pix',
      `Pix ${row.name}`,
      row.amount > 0 ? 'Recebido' : 'Enviado',
      signed(row.amount),
    ].join(';')),
  ].join('\n');
}

function submit(token: string, booksy: string, statement: string) {
  return request(app)
    .post('/api/audits')
    .set('Authorization', `Bearer ${token}`)
    .field('defaultCommissionRate', '0.4')
    .attach('booksy', Buffer.from(booksy, 'utf8'), { filename: 'booksy.csv', contentType: 'text/csv' })
    .attach('infinitepay', Buffer.from(statement, 'utf8'), { filename: 'extrato.csv', contentType: 'text/csv' });
}

/** Par que fecha: 500 vendidos, 500 recebidos. */
const MATCHING_BOOKSY = booksyCsv([
  { service: 'Unhas', price: 300, day: 5 },
  { service: 'Sobrancelhas', price: 200, day: 6 },
]);
const MATCHING_STATEMENT = statementCsv([
  { day: 5, time: '12:00', name: 'MARIA SOUZA', amount: 300 },
  { day: 6, time: '12:00', name: 'ANA LIMA', amount: 200 },
]);

describe('POST /api/audits', () => {
  it('importa os dois relatórios num só envio e aprova o mês', async () => {
    const token = await adminToken();
    const response = await submit(token, MATCHING_BOOKSY, MATCHING_STATEMENT);

    expect(response.status).toBe(201);
    expect(response.body.data.booksy.importedCount).toBe(2);
    expect(response.body.data.infinitepay.importedCount).toBe(2);

    const audit = response.body.data.audits.find((item: { period: string }) => item.period === '2026-10');
    expect(audit.outcome).toBe('aprovada');
    expect(audit.faturamentoBooksy).toBeCloseTo(500, 2);
    expect(audit.entradasInfinitepay).toBeCloseTo(500, 2);
    expect(audit.diferenca).toBeCloseTo(0, 2);
    expect(audit.approvedAt).not.toBeNull();
  });

  it('barra o mês quando os valores não fecham, com o valor da diferença', async () => {
    const token = await adminToken();
    const statement = statementCsv([{ day: 5, time: '12:00', name: 'MARIA SOUZA', amount: 440 }]);

    const response = await submit(token, MATCHING_BOOKSY, statement);

    const audit = response.body.data.audits[0];
    expect(audit.outcome).toBe('divergente');
    expect(audit.diferenca).toBeCloseTo(60, 2);
    expect(audit.approvedAt).toBeNull();
  });

  it('exige os dois arquivos', async () => {
    const token = await adminToken();
    const response = await request(app)
      .post('/api/audits')
      .set('Authorization', `Bearer ${token}`)
      .attach('booksy', Buffer.from(MATCHING_BOOKSY, 'utf8'), { filename: 'booksy.csv', contentType: 'text/csv' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/dois relatórios/i);
    // Nada foi gravado: a submissão é um evento só.
    expect(await Transaction.countDocuments({})).toBe(0);
  });

  it('desfaz o primeiro arquivo quando o segundo falha', async () => {
    const token = await adminToken();
    // Extrato com o total declarado errado: o parser recusa.
    const broken = MATCHING_STATEMENT.replace('Total de entradas;+ 500,00', 'Total de entradas;+ 999,00');

    const response = await submit(token, MATCHING_BOOKSY, broken);

    expect(response.status).toBeGreaterThanOrEqual(400);
    // Meia submissão deixaria outubro com só o Booksy — o estado que a auditoria impede.
    expect(await Transaction.countDocuments({ deletedAt: null })).toBe(0);
  });

  it('colaboradora não audita', async () => {
    const token = tokenFor(await createUser({ role: 'colaborador' }));
    const response = await submit(token, MATCHING_BOOKSY, MATCHING_STATEMENT);
    expect(response.status).toBe(403);
  });
});

describe('GET /api/audits', () => {
  it('devolve o estado recalculado do mês', async () => {
    const token = await adminToken();
    await submit(token, MATCHING_BOOKSY, MATCHING_STATEMENT);

    const response = await request(app)
      .get('/api/audits')
      .query({ period: '2026-10' })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.outcome).toBe('aprovada');
    expect(response.body.data.saldoBruto).toBeCloseTo(500, 2);
    expect(response.body.data.saldoRetirado).toBe(0);
    expect(response.body.data.saldoLiquido).toBeCloseTo(500, 2);
  });

  it('recusa mês fora do formato', async () => {
    const token = await adminToken();
    const response = await request(app)
      .get('/api/audits')
      .query({ period: 'outubro' })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
  });
});

describe('POST /api/audits/:period/entries', () => {
  /** Deixa outubro divergente em 60. */
  async function divergent(token: string) {
    const statement = statementCsv([{ day: 5, time: '12:00', name: 'MARIA SOUZA', amount: 440 }]);
    await submit(token, MATCHING_BOOKSY, statement);
  }

  it('a taxa fecha a conta e entra como despesa', async () => {
    const token = await adminToken();
    await divergent(token);

    const response = await request(app)
      .post('/api/audits/2026-10/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 60, reason: 'taxa', description: 'Tarifa da maquininha' });

    expect(response.status).toBe(201);
    expect(response.body.data.outcome).toBe('aprovada');
    expect(response.body.data.diferenca).toBeCloseTo(0, 2);
    expect(response.body.data.ajusteManual).toBeCloseTo(60, 2);
    expect(response.body.data.approvedAt).not.toBeNull();

    // Taxa é custo real: aparece no DRE.
    const entry = await Transaction.findOne({ auditReason: 'taxa' }).lean();
    expect(entry?.type).toBe('despesa');
    expect(entry?.countsInDre).toBe(true);
    expect(entry?.auditDirection).toBe('faltou_entrar');
  });

  it('o dinheiro fecha a conta mas fica fora do DRE', async () => {
    const token = await adminToken();
    await divergent(token);

    const response = await request(app)
      .post('/api/audits/2026-10/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 60, reason: 'dinheiro', description: 'Cliente pagou em espécie' });

    expect(response.status).toBe(201);
    expect(response.body.data.outcome).toBe('aprovada');

    // O atendimento já está no faturamento do Booksy: contar outra vez dobraria a receita.
    const entry = await Transaction.findOne({ auditReason: 'dinheiro' }).lean();
    expect(entry?.countsInDre).toBe(false);

    const dre = await request(app)
      .get('/api/reports/dre')
      .query({ start: '2026-10-01T00:00:00.000Z', end: '2026-10-31T23:59:59.999Z' })
      .set('Authorization', `Bearer ${token}`);
    // 500 do Booksy + 440 do extrato; os 60 em dinheiro NÃO entram.
    expect(dre.body.data.faturamentoBruto).toBeCloseTo(940, 2);
  });

  it('o motivo "outro" exige a direção', async () => {
    const token = await adminToken();
    await divergent(token);

    const response = await request(app)
      .post('/api/audits/2026-10/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 60, reason: 'outro', description: 'Caso raro' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/faltou entrar|entrou a mais/i);
  });

  it('aceita "outro" quando a direção vem informada', async () => {
    const token = await adminToken();
    await divergent(token);

    const response = await request(app)
      .post('/api/audits/2026-10/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 60, reason: 'outro', direction: 'faltou_entrar', description: 'Caso raro' });

    expect(response.status).toBe(201);
    expect(response.body.data.outcome).toBe('aprovada');
  });

  it('recusa data fora do mês auditado', async () => {
    const token = await adminToken();
    await divergent(token);

    const response = await request(app)
      .post('/api/audits/2026-10/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 60,
        reason: 'taxa',
        description: 'Tarifa',
        occurredAt: '2026-11-15T10:00:00.000Z',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/2026-10/);
  });

  it('recusa valor zero ou negativo', async () => {
    const token = await adminToken();
    await divergent(token);

    for (const amount of [0, -60]) {
      const response = await request(app)
        .post('/api/audits/2026-10/entries')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount, reason: 'taxa', description: 'Tarifa' });
      expect(response.status).toBe(400);
    }
  });

  it('o ajuste cai no mês auditado mesmo lançado depois', async () => {
    const token = await adminToken();
    await divergent(token);

    await request(app)
      .post('/api/audits/2026-10/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 60, reason: 'taxa', description: 'Tarifa' });

    const entry = await Transaction.findOne({ auditReason: 'taxa' }).lean();
    expect(entry?.occurredAt.toISOString().slice(0, 7)).toBe('2026-10');

    const audit = await Audit.findOne({ period: '2026-10' }).lean();
    expect(audit?.approvedAt).toBeInstanceOf(Date);
  });
});
