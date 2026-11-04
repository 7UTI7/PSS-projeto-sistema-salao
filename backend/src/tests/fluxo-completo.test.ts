// Fluxo completo com os dois arquivos reais da dona: importar, conferir o mês, reenviar
// e desfazer o lote. É o teste que fecha os critérios de aceite combinados — por isso
// usa os arquivos de Documents/, e não fixtures montadas aqui.
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { Transaction } from '../models/transaction.model.js';
import { createUser, tokenFor, useTestDatabase } from './helpers.js';

useTestDatabase();

const DOCUMENTS = path.resolve(import.meta.dirname, '../../../Documents');

/** O PDF tem acento no nome e o Git pode gravá-lo em NFC ou NFD; acha pelos dois. */
function statementPath(): string {
  const match = readdirSync(DOCUMENTS).find((name) => /^relat.*rio\.pdf$/i.test(name));
  if (!match) throw new Error('relatório.pdf não encontrado em Documents/');
  return path.join(DOCUMENTS, match);
}

const BOOKSY_FILE = path.join(DOCUMENTS, 'business-performance-report.xlsx');

/** Mês fechado em UTC, como o período do app. */
function monthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString(),
  };
}

let token = '';

beforeEach(async () => {
  token = tokenFor(await createUser({ role: 'admin' }));
});

function importFile(source: 'booksy' | 'infinitepay') {
  const file = source === 'booksy' ? BOOKSY_FILE : statementPath();
  return request(app)
    .post('/api/imports')
    .set('Authorization', `Bearer ${token}`)
    .field('source', source)
    .field('defaultCommissionRate', '0.4')
    .attach('file', readFileSync(file), { filename: path.basename(file) });
}

function summary(year: number, month: number) {
  return request(app)
    .get('/api/reports/dre')
    .query(monthRange(year, month))
    .set('Authorization', `Bearer ${token}`);
}

describe('Os dois arquivos reais, de ponta a ponta', () => {
  it('importa as duas origens e fecha o mês com o total do arquivo', async () => {
    const booksy = await importFile('booksy');
    expect(booksy.status).toBe(201);
    const statement = await importFile('infinitepay');
    expect(statement.status).toBe(201);

    // Agosto é o mês do Booksy. O relatório declara 34 atendimentos; 6 foram cancelados
    // ou no-show e não entram, então ficam 28 lançamentos.
    const agosto = await summary(2026, 8);
    expect(agosto.status).toBe(200);
    const vendidoAgosto = await Transaction.aggregate<{ bruto: number; desconto: number; n: number }>([
      { $match: { origin: 'booksy', type: 'receita', deletedAt: null } },
      { $group: { _id: null, bruto: { $sum: '$grossAmount' }, desconto: { $sum: '$discountAmount' }, n: { $sum: 1 } } },
    ]);
    expect(agosto.body.data.faturamentoBruto).toBeCloseTo(vendidoAgosto[0]?.bruto ?? 0, 2);
    expect(agosto.body.data.descontos).toBeCloseTo(vendidoAgosto[0]?.desconto ?? 0, 2);

    // Outubro é o mês do extrato. O PDF imprime "Total de entradas + 6.938,28".
    const outubro = await summary(2026, 10);
    const entradasOutubro = await Transaction.aggregate<{ bruto: number }>([
      { $match: { origin: 'infinitepay', type: 'receita', deletedAt: null,
        occurredAt: { $gte: new Date(monthRange(2026, 10).start), $lte: new Date(monthRange(2026, 10).end) } } },
      { $group: { _id: null, bruto: { $sum: '$grossAmount' } } },
    ]);
    expect(outubro.body.data.faturamentoBruto).toBeCloseTo(entradasOutubro[0]?.bruto ?? 0, 2);
  }, 120_000);

  it('o resumo do mês confere com a soma dos lançamentos daquele mês', async () => {
    await importFile('booksy');
    await importFile('infinitepay');

    // É o critério "Painel e Lançamentos mostram os mesmos números": as duas telas leem
    // este mesmo /reports/dre, então o que resta provar é que ele bate com as linhas.
    const range = monthRange(2026, 8);
    const resumo = await summary(2026, 8);
    const linhas = await Transaction.find({
      deletedAt: null,
      status: { $ne: 'cancelada' },
      occurredAt: { $gte: new Date(range.start), $lte: new Date(range.end) },
    }).lean();

    const esperado = linhas.reduce(
      (acc, linha) => {
        if (linha.type === 'receita') {
          acc.bruto += linha.grossAmount;
          acc.descontos += linha.discountAmount;
          acc.taxas += linha.feeAmount;
          acc.comissoes += linha.commissionAmount;
        } else {
          acc.despesas += linha.grossAmount;
        }
        return acc;
      },
      { bruto: 0, descontos: 0, taxas: 0, comissoes: 0, despesas: 0 },
    );

    expect(resumo.body.data.faturamentoBruto).toBeCloseTo(esperado.bruto, 2);
    expect(resumo.body.data.descontos).toBeCloseTo(esperado.descontos, 2);
    expect(resumo.body.data.taxas).toBeCloseTo(esperado.taxas, 2);
    expect(resumo.body.data.comissoes).toBeCloseTo(esperado.comissoes, 2);
    expect(resumo.body.data.despesas).toBeCloseTo(esperado.despesas, 2);
    expect(resumo.body.data.receitaLiquida).toBeCloseTo(
      esperado.bruto - esperado.descontos - esperado.taxas, 2,
    );
    expect(resumo.body.data.lucroEstudio).toBeCloseTo(
      esperado.bruto - esperado.descontos - esperado.taxas - esperado.comissoes - esperado.despesas, 2,
    );
  }, 120_000);

  it('reenviar o mesmo arquivo não duplica, e desfazer o lote recalcula', async () => {
    const primeiro = await importFile('booksy');
    const criados = primeiro.body.data.importedCount;
    const antes = await summary(2026, 8);

    const reenvio = await importFile('booksy');
    expect(reenvio.status).toBe(409);
    const depoisDoReenvio = await summary(2026, 8);
    expect(depoisDoReenvio.body.data.faturamentoBruto).toBeCloseTo(antes.body.data.faturamentoBruto, 2);

    const desfazer = await request(app)
      .delete(`/api/imports/${primeiro.body.data.batchId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(desfazer.status).toBe(200);
    expect(desfazer.body.data.removedCount).toBe(criados);

    const zerado = await summary(2026, 8);
    expect(zerado.body.data.faturamentoBruto).toBe(0);
    expect(zerado.body.data.lucroEstudio).toBe(0);

    // E depois de desfazer, o mesmo arquivo pode voltar inteiro.
    const novamente = await importFile('booksy');
    expect(novamente.status).toBe(201);
    expect(novamente.body.data.importedCount).toBe(criados);
  }, 120_000);
});
