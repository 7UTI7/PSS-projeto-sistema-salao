// A auditoria com um par de arquivos do MESMO mês.
//
// É o teste que faltava. O outro par de Documents/ cobre meses diferentes (Booksy em
// agosto, extrato em outubro), então com ele a auditoria só podia cair em "fonte
// ausente" — os Cenários A e B nunca apareciam com arquivo de verdade, só com fixture
// montada à mão.
//
// Este par é de outubro/2026 dos dois lados, nos formatos que o app recebe: o relatório
// do Booksy em .xlsx e o extrato em .pdf.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { Transaction } from '../models/transaction.model.js';
import { createUser, tokenFor, useTestDatabase } from './helpers.js';

useTestDatabase();

const DOCUMENTS = path.resolve(import.meta.dirname, '../../../Documents');
const BOOKSY = path.join(DOCUMENTS, 'FICTICIO_business-performance-report (1).xlsx');
const EXTRATO = path.join(DOCUMENTS, 'FICTICIO_relatorio_movimentacoes (1).pdf');

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

    // Booksy: 33 agendamentos, 4 cancelados -> 29 atendimentos, R$ 2.000,00, que é o que
    // a própria linha "Total" do arquivo declara.
    expect(response.body.data.booksy.importedCount).toBe(29);

    // Extrato: 25 movimentos — 23 entradas (Pix recebido + depósito de vendas) somando
    // R$ 1.800,00, e 2 saídas somando R$ 400,00. O PDF declara os dois totais no resumo,
    // e a leitura é conferida contra eles antes de gravar.
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

  it('as duas saídas viram retirada, não despesa', async () => {
    await submit();

    // Neste extrato o titular é "EMPRESA TESTE FICTICIA LTDA" e a contraparte da saída é
    // o nome de uma pessoa: nenhum movimento casa com o titular, então o nome não informa
    // nada e toda saída conta como retirada.
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

  it('avisa quando os dois arquivos vão trocados de campo', async () => {
    // Engano fácil: o seletor do campo do Booksy também aceita .pdf e .csv, então dá para
    // pôr o extrato ali. Antes a resposta era "não encontrei a aba Lista de agendamentos",
    // uma mensagem sobre a estrutura do arquivo quando o problema era só o campo.
    const response = await request(app)
      .post('/api/audits')
      .set('Authorization', `Bearer ${token}`)
      .attach('booksy', readFileSync(EXTRATO), { filename: path.basename(EXTRATO) })
      .attach('infinitepay', readFileSync(BOOKSY), { filename: path.basename(BOOKSY) });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('é o extrato da InfinitePay');
    expect(response.body.message).toContain('Troque os dois de campo');
  }, 120_000);

  it('avisa também quando o campo da InfinitePay recebe o do Booksy', async () => {
    const response = await request(app)
      .post('/api/audits')
      .set('Authorization', `Bearer ${token}`)
      .attach('booksy', readFileSync(BOOKSY), { filename: path.basename(BOOKSY) })
      .attach('infinitepay', readFileSync(BOOKSY), { filename: path.basename(BOOKSY) });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('é o relatório do Booksy');
  }, 120_000);
});

/**
 * O mesmo extrato exportado como CSV em vez de PDF.
 *
 * Fica numa fixture montada aqui, e não num arquivo de Documents/, porque o que se prova
 * é o LEITOR: as colunas por nome, a data em DD/MM/AAAA, o valor sem sinal explícito e o
 * apelido de MIME que o seletor do Android manda. Um arquivo na pasta podia ser
 * substituído e levar esta prova embora.
 */
describe('O extrato exportado como CSV', () => {
  const CSV = [
    'Data;Hora;Tipo de transação;Nome;Detalhe;Valor (R$)',
    '01/10/2026;11:51;Pix;Cliente Exemplo Um;Recebido;90,00',
    '17/10/2026;04:20;Depósito de vendas;Vendas;Depósito Banco Exemplo;40,00',
    '12/10/2026;18:29;Pix;Titular da Conta;Enviado;-250,00',
  ].join('\n');

  it('lê as colunas e trata a saída como retirada', async () => {
    const response = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .field('source', 'infinitepay')
      // É este MIME que o seletor do Android informa para um .csv. O servidor recusava, e
      // era a falha de importação que ela via depois de escolher o arquivo.
      // O BOM que o Excel escreve no começo do arquivo vai junto, de propósito: é assim
      // que o CSV chega na prática, e a leitura precisa ignorá-lo.
      .attach('file', Buffer.from(`\uFEFF${CSV}`, 'utf8'), {
        filename: 'movimentacoes.csv',
        contentType: 'text/comma-separated-values',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.importedCount).toBe(3);

    const retirada = await Transaction.findOne({ countsInDre: false, deletedAt: null }).lean();
    expect(retirada?.grossAmount).toBe(250);
    expect(retirada?.category).toBe('Retiradas para a conta do salão');

    const entradas = await Transaction.find({
      type: 'receita',
      countsInDre: { $ne: false },
      deletedAt: null,
    }).lean();
    expect(entradas.reduce((total, row) => total + row.grossAmount, 0)).toBeCloseTo(130, 2);

    // A hora da planilha entra no horário do movimento, em UTC como o resto do app.
    expect(entradas.find((row) => row.grossAmount === 90)?.occurredAt.toISOString())
      .toBe('2026-10-01T11:51:00.000Z');
  });
});
