// Testes de ponta a ponta das rotas /api/imports: RBAC, dedupe, lançamentos e rollback.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { Category } from '../models/category.model.js';
import { ImportBatch } from '../models/import-batch.model.js';
import { Transaction } from '../models/transaction.model.js';
import { createUser, tokenFor, useTestDatabase } from './helpers.js';

useTestDatabase();

interface StatementLine {
  /** Preenchida so na primeira linha de cada dia, como o extrato faz. */
  date?: string;
  time: string;
  kind: string;
  name: string;
  detail: string;
  amount: number;
}

/**
 * Monta um "Relatorio de movimentacoes" em CSV com o bloco de resumo coerente com as linhas.
 * O parser confere a leitura contra esses totais, entao eles precisam ser calculados e nao
 * escritos a mao: um fixture com total errado reprovaria por motivo errado.
 */
function statementCsv(lines: readonly StatementLine[]): string {
  const credits = lines.filter((line) => line.amount > 0).reduce((total, line) => total + line.amount, 0);
  const debits = lines.filter((line) => line.amount < 0).reduce((total, line) => total + line.amount, 0);
  const signed = (value: number, space = '') =>
    `${value < 0 ? '-' : '+'}${space}${Math.abs(value).toFixed(2).replace('.', ',')}`;

  return [
    '60.441.829 NICOLLE NERIS RODRIGUES - CNPJ: 60.441.829/0001-51',
    'Saldo inicial;+ 0,00',
    `Total de entradas;${signed(credits, ' ')}`,
    `Total de saidas;${signed(debits, ' ')}`,
    `Saldo final do periodo;${signed(credits + debits, ' ')}`,
    'Data;Hora;Tipo de transacao;Nome;Detalhe;Valor (R$)',
    ...lines.map((line) => [
      line.date ?? '',
      line.time,
      line.kind,
      line.name,
      line.detail,
      signed(line.amount),
    ].join(';')),
  ].join('\n');
}

/**
 * Tres movimentos que viram lancamento (dois Pix recebidos e um repasse da maquininha) e uma
 * transferencia para a propria titular, que de proposito nao vira lancamento.
 */
const STATEMENT_LINES: StatementLine[] = [
  { date: '01 Out, 2026', time: '09:00', kind: 'Pix', name: 'Pix MARIA SOUZA', detail: 'Recebido', amount: 100 },
  { time: '10:00', kind: 'Deposito de vendas', name: 'Vendas', detail: 'Deposito InfinitePay', amount: 60 },
  { date: '02 Out, 2026', time: '08:00', kind: 'Pix', name: 'Pix ANA LIMA', detail: 'Recebido', amount: 40 },
  { time: '18:00', kind: 'Pix', name: 'Pix Nicolle Neris Rodrigues', detail: 'Enviado', amount: -150 },
];

const STATEMENT_CSV = statementCsv(STATEMENT_LINES);

async function adminToken(): Promise<string> {
  const admin = await createUser({ role: 'admin' });
  return tokenFor(admin);
}

function upload(token: string, path = '/api/imports') {
  return request(app)
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .field('source', 'infinitepay')
    .attach('file', Buffer.from(STATEMENT_CSV, 'utf8'), {
      filename: 'extrato-infinitepay.csv',
      contentType: 'text/csv',
    });
}

describe('POST /api/imports', () => {
  it('exige autenticação', async () => {
    const response = await request(app).post('/api/imports');
    expect(response.status).toBe(401);
  });

  it('nega acesso a colaboradora', async () => {
    const collaborator = await createUser({ role: 'colaborador' });
    const response = await upload(tokenFor(collaborator));
    expect(response.status).toBe(403);
  });

  it('recusa o envio sem arquivo', async () => {
    const token = await adminToken();
    const response = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .field('source', 'booksy');
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('file');
  });

  it('recusa extensão não suportada', async () => {
    const token = await adminToken();
    const response = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .field('source', 'booksy')
      .attach('file', Buffer.from('nada'), { filename: 'relatorio.docx', contentType: 'application/octet-stream' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/\.xlsx|\.csv/);
  });

  it('recusa origem inválida', async () => {
    const token = await adminToken();
    const response = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .field('source', 'stone')
      .attach('file', Buffer.from(STATEMENT_CSV), { filename: 'x.csv', contentType: 'text/csv' });
    expect(response.status).toBe(400);
  });

  it('cria os lançamentos de caixa, as categorias e o lote', async () => {
    const token = await adminToken();
    const response = await upload(token);

    expect(response.status).toBe(201);
    expect(response.body.data.importedCount).toBe(3);
    expect(response.body.data.duplicateCount).toBe(0);
    expect(response.body.data.createdCategories)
      .toEqual(['Recebimentos Pix', 'Vendas na maquininha']);
    expect(response.body.data.totals.grossAmount).toBeCloseTo(200, 2);
    expect(response.body.data.periodStart).toContain('2026-10-01');
    expect(response.body.data.periodEnd).toContain('2026-10-02');

    // A transferência para a titular é informada, mas não entra como despesa.
    expect(response.body.data.asides).toHaveLength(1);
    expect(response.body.data.asides[0].count).toBe(1);
    expect(response.body.data.asides[0].amount).toBeCloseTo(-150, 2);

    const transactions = await Transaction.find({ deletedAt: null }).sort({ occurredAt: 1 }).lean();
    expect(transactions).toHaveLength(3);
    expect(transactions.every((transaction) => transaction.type === 'receita')).toBe(true);
    expect(transactions[0]?.origin).toBe('infinitepay');
    expect(transactions[0]?.grossAmount).toBeCloseTo(100, 2);
    expect(transactions[0]?.paymentMethod).toBe('pix');
    expect(transactions[0]?.status).toBe('liquidada');
    // Extrato é dinheiro já na conta: liquidado, então alimenta o Fluxo de Caixa.
    expect(transactions[0]?.settledAt).toBeInstanceOf(Date);
    // O extrato não traz taxa nem diz quem atendeu: nada de tarifa nem de comissão.
    expect(transactions[0]?.feeAmount).toBe(0);
    expect(transactions[0]?.commissionAmount).toBe(0);
    expect(transactions[0]?.studioNetProfit).toBeCloseTo(100, 2);

    const deposit = transactions.find((transaction) => transaction.category === 'Vendas na maquininha');
    expect(deposit?.paymentMethod).toBe('credito');

    // A natureza da categoria vem do lançamento, não da origem do arquivo.
    expect((await Category.findOne({ name: 'Recebimentos Pix' }).lean())?.kind).toBe('receita');

    const batch = await ImportBatch.findById(response.body.data.batchId).lean();
    expect(batch?.status).toBe('processed');
    expect(batch?.importedCount).toBe(3);
  });

  it('recusa o mesmo arquivo duas vezes (dedupe por hash)', async () => {
    const token = await adminToken();
    await upload(token);
    const second = await upload(token);

    expect(second.status).toBe(409);
    expect(second.body.message).toContain('já foi importado');
    expect(await Transaction.countDocuments({ deletedAt: null })).toBe(3);
  });

  it('não duplica linhas já importadas quando o arquivo muda', async () => {
    const token = await adminToken();
    await upload(token);

    // Extrato de um período maior, repetindo os movimentos já importados: só o novo entra.
    const extended = statementCsv([
      ...STATEMENT_LINES,
      { date: '05 Out, 2026', time: '14:00', kind: 'Pix', name: 'Pix JOANA DIAS', detail: 'Recebido', amount: 25 },
    ]);
    const response = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .field('source', 'infinitepay')
      .attach('file', Buffer.from(extended, 'utf8'), { filename: 'extrato-2.csv', contentType: 'text/csv' });

    expect(response.status).toBe(201);
    expect(response.body.data.importedCount).toBe(1);
    expect(response.body.data.duplicateCount).toBe(3);
    expect(await Transaction.countDocuments({ deletedAt: null })).toBe(4);
  });

  it('aplica a comissão padrão informada no formulário', async () => {
    const token = await adminToken();
    await Category.create({ name: 'Unhas', kind: 'receita', active: true });

    const booksyCsv = [
      'Data e hora;ID da Reserva;Categoria principal;Serviço;Funcionário;Valor dos serviços;Desconto;Receita total;Status',
      '01/03/2025 10:00;777;Unhas;Banho em Gel;Stephany Mendes;100,00;0;100,00;Concluída',
    ].join('\n');

    const response = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .field('source', 'booksy')
      .field('defaultCommissionRate', '0.4')
      .attach('file', Buffer.from(booksyCsv, 'utf8'), { filename: 'booksy.csv', contentType: 'text/csv' });

    expect(response.status).toBe(201);
    const transaction = await Transaction.findOne({ externalId: '777' }).lean();
    expect(transaction?.type).toBe('receita');
    expect(transaction?.professional).toBe('Stefany');
    expect(transaction?.commissionAmount).toBeCloseTo(40, 2);
    expect(transaction?.studioNetProfit).toBeCloseTo(60, 2);
    expect(transaction?.status).toBe('liquidada');
    expect(transaction?.paymentMethod).toBe('nao_informado');
  });

  it('recusa comissão fora da faixa 0..1', async () => {
    const token = await adminToken();
    const response = await request(app)
      .post('/api/imports')
      .set('Authorization', `Bearer ${token}`)
      .field('source', 'infinitepay')
      .field('defaultCommissionRate', '1.5')
      .attach('file', Buffer.from(STATEMENT_CSV), { filename: 'x.csv', contentType: 'text/csv' });
    expect(response.status).toBe(400);
  });
});

describe('POST /api/imports/preview', () => {
  it('mostra o resumo sem gravar nada', async () => {
    const token = await adminToken();
    const response = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .field('source', 'infinitepay')
      .attach('file', Buffer.from(STATEMENT_CSV, 'utf8'), { filename: 'extrato.csv', contentType: 'text/csv' });

    expect(response.status).toBe(200);
    expect(response.body.data.rowCount).toBe(3);
    expect(response.body.data.alreadyImported).toBe(false);
    expect(response.body.data.missingCategories)
      .toEqual(['Recebimentos Pix', 'Vendas na maquininha']);
    expect(response.body.data.warnings).toEqual([]);
    expect(response.body.data.rows).toBeUndefined();

    expect(await Transaction.countDocuments()).toBe(0);
    expect(await ImportBatch.countDocuments()).toBe(0);
    expect(await Category.countDocuments()).toBe(0);
  });

  it('avisa quando o arquivo já foi importado', async () => {
    const token = await adminToken();
    await upload(token);

    const response = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .field('source', 'infinitepay')
      .attach('file', Buffer.from(STATEMENT_CSV, 'utf8'), { filename: 'extrato.csv', contentType: 'text/csv' });

    expect(response.status).toBe(200);
    expect(response.body.data.alreadyImported).toBe(true);
  });
});

describe('GET /api/imports', () => {
  it('lista os lotes do mais recente para o mais antigo', async () => {
    const token = await adminToken();
    await upload(token);

    const response = await request(app).get('/api/imports').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      source: 'infinitepay',
      fileName: 'extrato-infinitepay.csv',
      status: 'processed',
      importedCount: 3,
    });
    // O payload bruto é grande e não interessa à tela.
    expect(response.body.data[0].rawPayload).toBeUndefined();
  });
});

describe('DELETE /api/imports/:id', () => {
  it('desfaz o lote e libera o reenvio do arquivo', async () => {
    const token = await adminToken();
    const created = await upload(token);
    const batchId = created.body.data.batchId;

    const rollback = await request(app).delete(`/api/imports/${batchId}`).set('Authorization', `Bearer ${token}`);
    expect(rollback.status).toBe(200);
    expect(rollback.body.data.removedCount).toBe(3);

    expect(await Transaction.countDocuments({ deletedAt: null })).toBe(0);
    const batch = await ImportBatch.findById(batchId).lean();
    expect(batch?.status).toBe('rolled_back');

    // Com o lote desfeito, o mesmo arquivo pode ser reenviado.
    const again = await upload(token);
    expect(again.status).toBe(201);
    expect(again.body.data.importedCount).toBe(3);
  });

  it('não desfaz duas vezes', async () => {
    const token = await adminToken();
    const created = await upload(token);
    await request(app).delete(`/api/imports/${created.body.data.batchId}`).set('Authorization', `Bearer ${token}`);

    const second = await request(app)
      .delete(`/api/imports/${created.body.data.batchId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(409);
  });

  it('recusa identificador malformado', async () => {
    const token = await adminToken();
    const response = await request(app).delete('/api/imports/abc').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
  });
});

describe('Lançamento importado é somente leitura', () => {
  /** Monta o corpo que o formulário mandaria, para provar que o 403 não é de validação. */
  function bodyFor(transaction: { description: string; grossAmount: number; category: string }) {
    return {
      type: 'receita',
      description: transaction.description,
      grossAmount: transaction.grossAmount,
      discountAmount: 0,
      professionalCommissionRate: 0,
      category: transaction.category,
      paymentMethod: 'pix',
      occurredAt: '2026-10-01T09:00:00.000Z',
      status: 'liquidada',
    };
  }

  it('recusa editar e excluir, e aponta o caminho do lote', async () => {
    const token = await adminToken();
    await upload(token);
    const imported = await Transaction.findOne({ origin: 'infinitepay', deletedAt: null }).lean();
    expect(imported).not.toBeNull();

    const edit = await request(app)
      .put(`/api/transactions/${imported?._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send(bodyFor({ description: 'Editado à mão', grossAmount: 999, category: imported?.category ?? 'Recebimentos Pix' }));
    expect(edit.status).toBe(403);
    expect(edit.body.message).toMatch(/desfa|lote/i);

    const remove = await request(app)
      .delete(`/api/transactions/${imported?._id.toString()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(remove.status).toBe(403);

    // Nada mudou: o valor segue o do arquivo e a linha continua ativa.
    const after = await Transaction.findById(imported?._id).lean();
    expect(after?.grossAmount).toBe(imported?.grossAmount);
    expect(after?.deletedAt).toBeNull();
  });

  it('não atribui profissional às linhas do extrato', async () => {
    const token = await adminToken();
    await upload(token);
    const rows = await Transaction.find({ origin: 'infinitepay', deletedAt: null }).lean();

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.professional).toBeUndefined();
      // Sem saber quem atendeu não há base para comissão.
      expect(row.commissionAmount).toBe(0);
    }
  });
});
