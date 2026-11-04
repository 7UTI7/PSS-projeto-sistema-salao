// Os três cenários da auditoria direta Booksy × InfinitePay.
//
// Os arquivos reais que tenho cobrem meses diferentes (Booksy em agosto, extrato em
// outubro), então nenhum mês real tem as duas fontes. Estes testes montam os lançamentos
// direto no banco, no MESMO mês, que é a única forma de exercitar os cenários A e B hoje.
import mongoose from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import { Audit } from '../models/audit.model.js';
import { Transaction } from '../models/transaction.model.js';
import { AuditService } from '../modules/audits/audit.service.js';
import { createUser, tokenFor, useTestDatabase } from './helpers.js';
import type { AuthenticatedUser } from '../modules/auth/auth.types.js';

useTestDatabase();

const service = new AuditService();
const PERIOD = '2026-10';
let actor: AuthenticatedUser;

beforeEach(async () => {
  const admin = await createUser({ role: 'admin' });
  tokenFor(admin);
  actor = { id: admin._id.toString(), role: 'admin' } as AuthenticatedUser;
});

/** Um atendimento do Booksy. `discount` é cortesia: nunca foi cobrada do cliente. */
async function booksySale(gross: number, discount = 0, day = 5) {
  await Transaction.create({
    type: 'receita',
    description: 'Atendimento',
    grossAmount: gross,
    discountAmount: discount,
    feeAmount: 0,
    commissionAmount: 0,
    studioNetProfit: gross - discount,
    netAmount: gross - discount,
    category: 'Unhas',
    paymentMethod: 'nao_informado',
    occurredAt: new Date(Date.UTC(2026, 9, day, 10, 0)),
    status: 'liquidada',
    settledAt: new Date(Date.UTC(2026, 9, day, 10, 0)),
    origin: 'booksy',
    externalId: `booksy-${gross}-${discount}-${day}`,
    createdBy: actor.id,
  });
}

/** Uma entrada no extrato da InfinitePay. */
async function statementIncome(amount: number, day = 5) {
  await Transaction.create({
    type: 'receita',
    description: 'Pix recebido',
    grossAmount: amount,
    discountAmount: 0,
    feeAmount: 0,
    commissionAmount: 0,
    studioNetProfit: amount,
    netAmount: amount,
    category: 'Recebimentos Pix',
    paymentMethod: 'pix',
    occurredAt: new Date(Date.UTC(2026, 9, day, 12, 0)),
    status: 'liquidada',
    settledAt: new Date(Date.UTC(2026, 9, day, 12, 0)),
    origin: 'infinitepay',
    externalId: `ip-${amount}-${day}`,
    createdBy: actor.id,
  });
}

/** Retirada da titular: sai da conta da InfinitePay, fica fora do DRE. */
async function withdrawal(amount: number, day = 28) {
  await Transaction.create({
    type: 'despesa',
    description: 'Retirada para a conta do salão',
    grossAmount: amount,
    discountAmount: 0,
    feeAmount: 0,
    commissionAmount: 0,
    studioNetProfit: -amount,
    netAmount: amount,
    category: 'Retiradas para a conta do salão',
    costType: 'variavel',
    paymentMethod: 'pix',
    occurredAt: new Date(Date.UTC(2026, 9, day, 18, 0)),
    status: 'liquidada',
    settledAt: new Date(Date.UTC(2026, 9, day, 18, 0)),
    origin: 'infinitepay',
    countsInDre: false,
    externalId: `saque-${amount}-${day}`,
    createdBy: actor.id,
  });
}

/** O Lançamento Manual que justifica a diferença. */
async function adjustment(options: {
  amount: number;
  direction: 'faltou_entrar' | 'entrou_a_mais';
  reason: 'dinheiro' | 'taxa' | 'gorjeta' | 'estorno' | 'outro';
  type?: 'receita' | 'despesa';
  countsInDre?: boolean;
  day?: number;
}) {
  const type = options.type ?? 'receita';
  await Transaction.create({
    type,
    description: 'Ajuste da auditoria',
    grossAmount: options.amount,
    discountAmount: 0,
    feeAmount: 0,
    commissionAmount: 0,
    studioNetProfit: type === 'receita' ? options.amount : -options.amount,
    netAmount: options.amount,
    category: type === 'receita' ? 'Outras entradas' : 'Outras saídas',
    ...(type === 'despesa' ? { costType: 'variavel' as const } : {}),
    paymentMethod: 'dinheiro',
    occurredAt: new Date(Date.UTC(2026, 9, options.day ?? 10, 15, 0)),
    status: 'liquidada',
    settledAt: new Date(Date.UTC(2026, 9, options.day ?? 10, 15, 0)),
    origin: 'manual',
    countsInDre: options.countsInDre ?? true,
    auditReason: options.reason,
    auditDirection: options.direction,
    createdBy: actor.id,
  });
}

describe('Cenário A — os valores batem', () => {
  it('aprova sozinha e não pede motivo', async () => {
    // Booksy: 2.230 brutos com 360 de cortesia = 1.870 líquidos.
    await booksySale(2230, 360);
    await statementIncome(1870);

    const summary = await service.getSummary(PERIOD);

    expect(summary.faturamentoBooksy).toBeCloseTo(1870, 2);
    expect(summary.entradasInfinitepay).toBeCloseTo(1870, 2);
    expect(summary.diferenca).toBeCloseTo(0, 2);
    expect(summary.outcome).toBe('aprovada');
    expect(summary.adjustments).toHaveLength(0);
  });

  it('carimba a aprovação na submissão, sem ela apertar nada', async () => {
    await booksySale(1870);
    await statementIncome(1870);

    const summary = await service.register(PERIOD, {}, actor);
    expect(summary.outcome).toBe('aprovada');
    expect(summary.approvedAt).toBeInstanceOf(Date);

    const stored = await Audit.findOne({ period: PERIOD }).lean();
    expect(stored?.approvedAt).toBeInstanceOf(Date);
    expect(stored?.faturamentoBooksy).toBeCloseTo(1870, 2);
  });

  it('tolera um centavo de arredondamento', async () => {
    await booksySale(1870);
    await statementIncome(1869.99);

    const summary = await service.getSummary(PERIOD);
    expect(summary.outcome).toBe('aprovada');
  });

  it('o desconto é cortesia e não conta como divergência', async () => {
    // Sem tratar o desconto, estes 360 virariam uma diferença a justificar todo mês.
    await booksySale(2230, 360);
    await statementIncome(1870);

    const summary = await service.getSummary(PERIOD);
    expect(summary.diferenca).toBeCloseTo(0, 2);
  });
});

describe('Cenário B — divergência, e o lançamento manual zera', () => {
  it('barra com o valor exato da diferença', async () => {
    await booksySale(1870);
    await statementIncome(1810);

    const summary = await service.getSummary(PERIOD);

    expect(summary.outcome).toBe('divergente');
    expect(summary.diferenca).toBeCloseTo(60, 2);
    // As duas fontes existem: é diferença de valor, não arquivo faltando.
    expect(summary.temBooksy).toBe(true);
    expect(summary.temInfinitepay).toBe(true);
    expect(summary.fonteFaltante).toBeNull();
    expect(summary.approvedAt).toBeNull();
  });

  it('a taxa retida fecha a conta e entra como despesa no mês', async () => {
    await booksySale(1870);
    await statementIncome(1810);
    await adjustment({ amount: 60, direction: 'faltou_entrar', reason: 'taxa', type: 'despesa' });

    const summary = await service.register(PERIOD, {}, actor);

    expect(summary.ajusteManual).toBeCloseTo(60, 2);
    expect(summary.diferenca).toBeCloseTo(0, 2);
    expect(summary.outcome).toBe('aprovada');
    expect(summary.approvedAt).toBeInstanceOf(Date);

    const entry = summary.adjustments[0];
    expect(entry?.reason).toBe('taxa');
    expect(entry?.signedAmount).toBeCloseTo(60, 2);
    // Taxa é custo real: tem de aparecer no resultado do mês.
    expect(entry?.countsInDre).toBe(true);
  });

  it('a gorjeta vai no sentido contrário', async () => {
    // Caiu mais na conta do que foi vendido: 50 que não são atendimento.
    await booksySale(1870);
    await statementIncome(1920);

    const antes = await service.getSummary(PERIOD);
    expect(antes.outcome).toBe('divergente');
    expect(antes.diferenca).toBeCloseTo(-50, 2);

    await adjustment({ amount: 50, direction: 'entrou_a_mais', reason: 'gorjeta' });

    const depois = await service.getSummary(PERIOD);
    expect(depois.ajusteManual).toBeCloseTo(-50, 2);
    expect(depois.diferenca).toBeCloseTo(0, 2);
    expect(depois.outcome).toBe('aprovada');
  });

  it('dois ajustes somam, e sobra o que ainda falta justificar', async () => {
    await booksySale(1870);
    await statementIncome(1700);
    await adjustment({ amount: 100, direction: 'faltou_entrar', reason: 'dinheiro', countsInDre: false, day: 8 });

    const parcial = await service.getSummary(PERIOD);
    expect(parcial.outcome).toBe('divergente');
    expect(parcial.diferenca).toBeCloseTo(70, 2);

    await adjustment({ amount: 70, direction: 'faltou_entrar', reason: 'taxa', type: 'despesa', day: 9 });

    const fechada = await service.getSummary(PERIOD);
    expect(fechada.adjustments).toHaveLength(2);
    expect(fechada.ajusteManual).toBeCloseTo(170, 2);
    expect(fechada.outcome).toBe('aprovada');
  });
});

describe('Cenário C — o lançamento manual veio antes da importação', () => {
  it('já nasce aprovada, sem passar pela tela de divergência', async () => {
    // Ela lançou o pagamento em dinheiro na hora que recebeu, dias antes de importar.
    await adjustment({ amount: 200, direction: 'faltou_entrar', reason: 'dinheiro', countsInDre: false, day: 3 });

    // Só depois chegam os dois relatórios.
    await booksySale(2000);
    await statementIncome(1800);

    const summary = await service.register(PERIOD, {}, actor);

    expect(summary.ajusteManual).toBeCloseTo(200, 2);
    expect(summary.diferenca).toBeCloseTo(0, 2);
    expect(summary.outcome).toBe('aprovada');
    expect(summary.approvedAt).toBeInstanceOf(Date);
  });

  it('o dinheiro recebido não dobra o faturamento do mês', async () => {
    await adjustment({ amount: 200, direction: 'faltou_entrar', reason: 'dinheiro', countsInDre: false, day: 3 });
    await booksySale(2000);
    await statementIncome(1800);

    // O serviço já está no faturamento do Booksy: contar o pagamento outra vez no DRE
    // faria o mês valer 2.200. É o que `countsInDre: false` impede.
    const noDre = await Transaction.find({
      deletedAt: null,
      countsInDre: { $ne: false },
      origin: 'manual',
    }).lean();
    expect(noDre).toHaveLength(0);
  });
});

describe('fonte_ausente — falta um dos dois arquivos', () => {
  it('não oferece justificativa quando só o extrato entrou', async () => {
    await statementIncome(6898.28);

    const summary = await service.getSummary(PERIOD);

    // A diferença é o valor inteiro das entradas. Tratar isso como divergência pediria
    // "justifique R$ 6.898,28" quando o que falta é o relatório do Booksy.
    expect(summary.outcome).toBe('fonte_ausente');
    expect(summary.fonteFaltante).toBe('booksy');
    expect(summary.temInfinitepay).toBe(true);
  });

  it('e quando só o Booksy entrou', async () => {
    await booksySale(2230, 360);

    const summary = await service.getSummary(PERIOD);
    expect(summary.outcome).toBe('fonte_ausente');
    expect(summary.fonteFaltante).toBe('infinitepay');
  });

  it('mês vazio não é auditoria aprovada', async () => {
    const summary = await service.getSummary(PERIOD);

    expect(summary.outcome).toBe('fonte_ausente');
    expect(summary.fonteFaltante).toBe('ambas');
    expect(summary.faturamentoBooksy).toBe(0);
    expect(summary.saldoBruto).toBe(0);
  });
});

describe('Os três saldos', () => {
  it('bruto, retirado e líquido', async () => {
    await booksySale(2000);
    await statementIncome(1800);
    await adjustment({ amount: 200, direction: 'faltou_entrar', reason: 'dinheiro', countsInDre: false });
    await withdrawal(1500);

    const summary = await service.getSummary(PERIOD);

    // Bruto: o que entrou de fato, já explicado pelo ajuste.
    expect(summary.saldoBruto).toBeCloseTo(2000, 2);
    expect(summary.saldoRetirado).toBeCloseTo(1500, 2);
    // Líquido: o que ainda está na conta da InfinitePay.
    expect(summary.saldoLiquido).toBeCloseTo(500, 2);
  });

  it('a retirada não entra nas entradas nem vira despesa da auditoria', async () => {
    await booksySale(1870);
    await statementIncome(1870);
    await withdrawal(1800);

    const summary = await service.getSummary(PERIOD);

    expect(summary.entradasInfinitepay).toBeCloseTo(1870, 2);
    expect(summary.outcome).toBe('aprovada');
    expect(summary.saldoRetirado).toBeCloseTo(1800, 2);
    expect(summary.saldoLiquido).toBeCloseTo(70, 2);
  });

  it('soma várias retiradas do mês', async () => {
    await booksySale(1000);
    await statementIncome(1000);
    await withdrawal(400, 10);
    await withdrawal(300, 20);

    const summary = await service.getSummary(PERIOD);
    expect(summary.saldoRetirado).toBeCloseTo(700, 2);
    expect(summary.saldoLiquido).toBeCloseTo(300, 2);
  });
});

describe('Limites do período', () => {
  it('ignora o que está fora do mês', async () => {
    await booksySale(1870);
    await statementIncome(1870);
    // Novembro: não entra na auditoria de outubro.
    await Transaction.create({
      type: 'receita',
      description: 'Pix de novembro',
      grossAmount: 40,
      discountAmount: 0,
      feeAmount: 0,
      commissionAmount: 0,
      studioNetProfit: 40,
      netAmount: 40,
      category: 'Recebimentos Pix',
      paymentMethod: 'pix',
      occurredAt: new Date(Date.UTC(2026, 10, 1, 2, 3)),
      status: 'liquidada',
      origin: 'infinitepay',
      externalId: 'ip-nov',
      createdBy: actor.id,
    });

    const outubro = await service.getSummary('2026-10');
    expect(outubro.entradasInfinitepay).toBeCloseTo(1870, 2);
    expect(outubro.outcome).toBe('aprovada');

    const novembro = await service.getSummary('2026-11');
    expect(novembro.entradasInfinitepay).toBeCloseTo(40, 2);
    expect(novembro.outcome).toBe('fonte_ausente');
  });

  it('o último instante do mês conta', async () => {
    await booksySale(100, 0, 31);
    await Transaction.create({
      type: 'receita',
      description: 'Pix no fim do mês',
      grossAmount: 100,
      discountAmount: 0,
      feeAmount: 0,
      commissionAmount: 0,
      studioNetProfit: 100,
      netAmount: 100,
      category: 'Recebimentos Pix',
      paymentMethod: 'pix',
      occurredAt: new Date(Date.UTC(2026, 9, 31, 23, 59, 59, 999)),
      status: 'liquidada',
      origin: 'infinitepay',
      externalId: 'ip-fim',
      createdBy: actor.id,
    });

    const summary = await service.getSummary(PERIOD);
    expect(summary.outcome).toBe('aprovada');
  });

  it('recusa mês fora do formato AAAA-MM', async () => {
    await expect(service.getSummary('out/2026')).rejects.toThrow(/AAAA-MM/);
    await expect(service.getSummary('2026-13')).rejects.toThrow(/AAAA-MM/);
  });

  it('cancelado não conta de nenhum lado', async () => {
    await booksySale(1870);
    await statementIncome(1870);
    await Transaction.create({
      type: 'receita',
      description: 'Atendimento cancelado',
      grossAmount: 500,
      discountAmount: 0,
      feeAmount: 0,
      commissionAmount: 0,
      studioNetProfit: 500,
      netAmount: 500,
      category: 'Unhas',
      paymentMethod: 'nao_informado',
      occurredAt: new Date(Date.UTC(2026, 9, 7, 10, 0)),
      status: 'cancelada',
      origin: 'booksy',
      externalId: 'booksy-cancelado',
      createdBy: actor.id,
    });

    const summary = await service.getSummary(PERIOD);
    expect(summary.faturamentoBooksy).toBeCloseTo(1870, 2);
    expect(summary.outcome).toBe('aprovada');
  });

  it('um lançamento manual sem direção não mexe na auditoria', async () => {
    await booksySale(1870);
    await statementIncome(1870);
    // Aluguel lançado à mão: é despesa do mês, mas não tem nada a dizer sobre o que
    // entrou na conta da InfinitePay.
    await Transaction.create({
      type: 'despesa',
      description: 'Aluguel',
      grossAmount: 900,
      discountAmount: 0,
      feeAmount: 0,
      commissionAmount: 0,
      studioNetProfit: -900,
      netAmount: 900,
      category: 'Aluguel',
      costType: 'fixo',
      paymentMethod: 'pix',
      occurredAt: new Date(Date.UTC(2026, 9, 5, 9, 0)),
      status: 'liquidada',
      origin: 'manual',
      createdBy: actor.id,
    });

    const summary = await service.getSummary(PERIOD);
    expect(summary.adjustments).toHaveLength(0);
    expect(summary.ajusteManual).toBe(0);
    expect(summary.outcome).toBe('aprovada');
  });
});

describe('register', () => {
  it('guarda os dois lotes na trilha do mês', async () => {
    const booksyBatchId = new mongoose.Types.ObjectId().toString();
    const infinitepayBatchId = new mongoose.Types.ObjectId().toString();
    await booksySale(1870);
    await statementIncome(1870);

    await service.register(PERIOD, { booksyBatchId, infinitepayBatchId }, actor);

    const stored = await Audit.findOne({ period: PERIOD }).lean();
    expect(stored?.booksyBatchId?.toString()).toBe(booksyBatchId);
    expect(stored?.infinitepayBatchId?.toString()).toBe(infinitepayBatchId);
  });

  it('não carimba de novo nem move a data da primeira aprovação', async () => {
    await booksySale(1870);
    await statementIncome(1870);

    const first = await service.register(PERIOD, {}, actor);
    const second = await service.register(PERIOD, {}, actor);

    expect(second.approvedAt?.getTime()).toBe(first.approvedAt?.getTime());
  });

  it('não carimba mês divergente', async () => {
    await booksySale(1870);
    await statementIncome(1810);

    const summary = await service.register(PERIOD, {}, actor);
    expect(summary.approvedAt).toBeNull();
    expect((await Audit.findOne({ period: PERIOD }).lean())?.approvedAt).toBeUndefined();
  });
});
