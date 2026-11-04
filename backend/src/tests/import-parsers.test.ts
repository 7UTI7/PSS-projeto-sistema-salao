// Testes dos parsers de importação: leitura de planilha, Booksy e InfinitePay.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseBooksyReport, resolveProfessional } from '../modules/imports/booksy.parser.js';
import { parseInfinitePayStatement } from '../modules/imports/infinitepay.parser.js';
import type { SheetTable } from '../modules/imports/import.types.js';
import { isPdf } from '../modules/imports/pdf.reader.js';
import { readReport } from '../modules/imports/report.reader.js';
import {
  parseAmount,
  parseSpreadsheetDate,
  readCsv,
  readSpreadsheet,
} from '../modules/imports/spreadsheet.reader.js';

const options = { defaultCommissionRate: 0.4 };

/** Exportação real do Booksy versionada em Documents/, usada como fixture. */
const BOOKSY_FIXTURE = fileURLToPath(
  new URL('../../../Documents/business-performance-report.xlsx', import.meta.url),
);

function loadBooksyFixture(): Buffer | null {
  try {
    return readFileSync(BOOKSY_FIXTURE);
  } catch {
    return null;
  }
}

/** Pasta das exportações reais usadas como fixture. */
const DOCUMENTS_DIR = fileURLToPath(new URL('../../../Documents/', import.meta.url));

/**
 * O extrato foi salvo com o acento do nome em forma decomposta (NFD), e no Windows abrir
 * pelo nome escrito aqui (NFC) não encontra o arquivo. Procurar pelo padrão do nome
 * funciona nas duas formas.
 */
function loadStatementFixture(): Buffer | null {
  try {
    const name = readdirSync(DOCUMENTS_DIR).find((entry) => /^relat.*rio\.pdf$/i.test(entry));
    return name ? readFileSync(join(DOCUMENTS_DIR, name)) : null;
  } catch {
    return null;
  }
}

describe('parseAmount', () => {
  it('lê o formato pt-BR com separador de milhar', () => {
    expect(parseAmount('R$ 1.234,56')).toBe(1234.56);
    expect(parseAmount('1.495')).toBe(1495);
    expect(parseAmount('30')).toBe(30);
    // 1 ou 2 casas depois do separador continua sendo decimal.
    expect(parseAmount('96,01')).toBe(96.01);
    expect(parseAmount('0.123')).toBe(0.123);
  });

  it('lê o formato en-US', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('trata parênteses e sinal como negativo', () => {
    expect(parseAmount('(50,00)')).toBe(-50);
    expect(parseAmount('-12,30')).toBe(-12.3);
  });

  it('devolve null para célula vazia ou sem dígitos', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('—')).toBeNull();
  });
});

describe('parseSpreadsheetDate', () => {
  it('lê dd/mm/aaaa com e sem hora', () => {
    expect(parseSpreadsheetDate('22/08/2026 21:00')?.toISOString()).toBe('2026-08-22T21:00:00.000Z');
    expect(parseSpreadsheetDate('01/03/2025')?.toISOString()).toBe('2025-03-01T00:00:00.000Z');
  });

  it('lê ISO 8601', () => {
    expect(parseSpreadsheetDate('2026-08-22')?.toISOString()).toBe('2026-08-22T00:00:00.000Z');
  });

  it('lê o serial do Excel', () => {
    expect(parseSpreadsheetDate('45000')?.toISOString().slice(0, 10)).toBe('2023-03-15');
  });

  it('devolve null para texto que não é data', () => {
    expect(parseSpreadsheetDate('Total')).toBeNull();
    expect(parseSpreadsheetDate('')).toBeNull();
  });
});

describe('readCsv', () => {
  it('respeita aspas, separador ponto e vírgula e BOM', () => {
    const csv = '﻿Data;Valor;Descricao\r\n01/03/2025;"1.234,56";"Servico; com ponto e virgula"\r\n';
    const table = readCsv(Buffer.from(csv, 'utf8'), 'extrato.csv');
    expect(table.rows[0]).toEqual(['Data', 'Valor', 'Descricao']);
    expect(table.rows[1]).toEqual(['01/03/2025', '1.234,56', 'Servico; com ponto e virgula']);
  });

  it('desdobra aspas duplas escapadas', () => {
    const table = readCsv(Buffer.from('a,"diz ""oi""",c\n', 'utf8'), 'x.csv');
    expect(table.rows[0]).toEqual(['a', 'diz "oi"', 'c']);
  });
});

describe('resolveProfessional', () => {
  it('reconhece os nomes como o Booksy exporta', () => {
    expect(resolveProfessional('Nicolle Neris')).toBe('Nicolle');
    expect(resolveProfessional('Stephany Mendes')).toBe('Stefany');
  });

  it('devolve null para quem não está cadastrada', () => {
    expect(resolveProfessional('Camila Santos')).toBeNull();
    expect(resolveProfessional('')).toBeNull();
  });
});

describe('parseBooksyReport', () => {
  it('lê a exportação real do Booksy', () => {
    const fixture = loadBooksyFixture();
    if (!fixture) {
      // A fixture é um arquivo do estúdio; em CI sem ele o teste não tem o que verificar.
      expect(fixture).toBeNull();
      return;
    }

    const tables = readSpreadsheet(fixture, 'business-performance-report.xlsx');
    expect(tables.map((table) => table.name)).toContain('Lista de agendamentos');

    const { rows, skipped } = parseBooksyReport(tables, options);
    expect(rows.length).toBeGreaterThan(0);

    const first = rows[0];
    expect(first).toBeDefined();
    expect(first?.type).toBe('receita');
    expect(first?.professional).toMatch(/^(Nicolle|Stefany)$/);
    expect(first?.externalId).toMatch(/^\d+$/);
    expect(first?.grossAmount).toBeGreaterThan(0);
    expect(first?.professionalCommissionRate).toBe(0.4);
    expect(first?.paymentMethod).toBe('nao_informado');

    // Nenhuma linha pode ter desconto maior que o bruto: o CalculationService recusaria.
    for (const row of rows) expect(row.discountAmount).toBeLessThanOrEqual(row.grossAmount);

    // Linhas liquidadas alimentam o Fluxo de Caixa e precisam de settledAt.
    for (const row of rows) {
      if (row.status === 'liquidada') expect(row.settledAt).toBeInstanceOf(Date);
      else expect(row.settledAt).toBeUndefined();
    }

    // O rodapé "Total" não tem data e deve cair fora sem virar erro.
    expect(skipped.every((entry) => entry.reason.length > 0)).toBe(true);
  });

  it('importa a linha mesmo sem reconhecer a profissional, só não a atribui', () => {
    const tables = [{
      name: 'Lista de agendamentos',
      rows: [
        ['Data e hora', 'ID da Reserva', 'Categoria principal', 'Serviço', 'Funcionário', 'Valor dos serviços', 'Desconto', 'Status'],
        ['22/08/2026 21:00', '1', 'Unhas', 'Mão Simples', 'Camila Santos', '30', '0', 'Concluída'],
        ['22/08/2026 22:00', '2', 'Unhas', 'Pé Simples', 'Nicolle Neris', '35', '0', 'Concluída'],
      ],
    }];

    // O dinheiro é real mesmo quando o nome não é conhecido. Descartar a linha fazia o
    // mês inteiro sumir quando o relatório vinha com um nome fora do cadastro.
    const { rows, skipped } = parseBooksyReport(tables, options);
    expect(rows).toHaveLength(2);
    expect(skipped).toHaveLength(0);

    const desconhecida = rows.find((row) => row.description === 'Mão Simples');
    expect(desconhecida?.professional).toBeUndefined();
    expect(desconhecida?.grossAmount).toBe(30);

    expect(rows.find((row) => row.description === 'Pé Simples')?.professional).toBe('Nicolle');
  });

  it('limita o desconto ao valor bruto (cortesia lançada como desconto cheio)', () => {
    const tables = [{
      name: 'Lista de agendamentos',
      rows: [
        ['Data e hora', 'ID da Reserva', 'Serviço', 'Funcionário', 'Valor dos serviços', 'Desconto', 'Status'],
        ['22/08/2026 21:00', '9', 'Efeito Wispy', 'Nicolle Neris', '180', '200', 'Concluída'],
      ],
    }];

    const { rows } = parseBooksyReport(tables, options);
    expect(rows[0]?.grossAmount).toBe(180);
    expect(rows[0]?.discountAmount).toBe(180);
  });

  it('ignora a linha cuja receita total não confere com valor menos desconto', () => {
    const tables = [{
      name: 'Lista de agendamentos',
      rows: [
        ['Data e hora', 'ID da Reserva', 'Serviço', 'Funcionário', 'Valor dos serviços', 'Desconto', 'Receita total', 'Status'],
        ['22/08/2026 21:00', '11', 'Efeito Wispy', 'Nicolle Neris', '180', '0', '99', 'Concluída'],
      ],
    }];

    const { rows, skipped } = parseBooksyReport(tables, options);
    expect(rows).toHaveLength(0);
    expect(skipped[0]?.reason).toContain('não confere');
  });

  it('não importa cancelamento: não houve atendimento nem dinheiro', () => {
    const tables = [{
      name: 'Lista de agendamentos',
      rows: [
        ['Data e hora', 'ID da Reserva', 'Serviço', 'Funcionário', 'Valor dos serviços', 'Desconto', 'Receita total', 'Status'],
        ['21/08/2026 17:00', '12', 'Efeito Wispy', 'Nicolle Neris', '180', '0', '0', 'Cancelada'],
      ],
    }];

    const { rows, skipped } = parseBooksyReport(tables, options);
    expect(rows).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.reason).toContain('cancelado');
  });

  it('também deixa de fora a falta do cliente (no show)', () => {
    const tables = [{
      name: 'Lista de agendamentos',
      rows: [
        ['Data e hora', 'ID da Reserva', 'Serviço', 'Funcionário', 'Valor dos serviços', 'Status'],
        ['21/08/2026 17:00', '10', 'Efeito Wispy', 'Nicolle Neris', '180', 'No show'],
        ['21/08/2026 19:00', '11', 'Mão Simples', 'Stephany Mendes', '30', 'Concluída'],
      ],
    }];

    const { rows } = parseBooksyReport(tables, options);
    // Só o atendimento concluído entra, e o total do lote passa a ser o vendido de fato.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.grossAmount).toBe(30);
  });

  it('recusa o arquivo quando as colunas não são reconhecidas', () => {
    const tables = [{ name: 'Planilha1', rows: [['Coluna A', 'Coluna B'], ['1', '2']] }];
    expect(() => parseBooksyReport(tables, options)).toThrow(/Lista de agendamentos|colunas/i);
  });
});

// ---------------------------------------------------------------------------
// Extrato da InfinitePay (PDF)
// ---------------------------------------------------------------------------

/** Cabeçalho e bloco de resumo como o PDF real os traz, necessários para a conferência. */
function statementHeader(
  totalIn: string,
  totalOut: string,
  opening = '+ 100,00',
  closing = '+ 130,00',
): string[][] {
  return [
    ['60.441.829 NICOLLE NERIS RODRIGUES - CNPJ: 60.441.829/0001-51'],
    ['Relatório de movimentações'],
    ['01 Out, 2026 - 01 Nov, 2026', 'Valor em R$'],
    ['Saldo inicial', opening],
    ['Total de entradas', totalIn],
    ['Total de saídas', totalOut],
    ['Saldo final do período', closing],
    ['Data', 'Hora', 'Tipo de transação', 'Nome', 'Detalhe', 'Valor (R$)'],
  ];
}

/**
 * Movimentos de dois dias: recebimento por Pix, repasse da maquininha, pagamento a
 * fornecedor e transferência para a própria titular. Só a primeira linha de cada dia traz
 * a data, como no documento original.
 */
const STATEMENT_ROWS: string[][] = [
  ['01 Out, 2026', '09:00', 'Pix', 'Pix MARIA SOUZA', 'Recebido', '+100,00'],
  ['10:00', 'Depósito de vendas', 'Vendas', 'Depósito InfinitePay', '+60,00'],
  ['11:00', 'Pix', 'Pix FORNECEDOR ESMALTES LTDA', 'Enviado', '-80,00'],
  ['Saldo do dia', '+ 180,00'],
  ['Data', 'Hora', 'Tipo de transação', 'Nome', 'Detalhe', 'Valor (R$)'],
  ['02 Out, 2026', '08:00', 'Pix', 'Pix ANA LIMA', 'Recebido', '+100,00'],
  ['18:00', 'Pix', 'Pix Nicolle Neris Rodrigues', 'Enviado', '-150,00'],
  ['Saldo do dia', '+ 130,00'],
  ['A Central de Ajuda está disponível todos os dias pelo chat no app', 'Página 1 de 1'],
];

function statementTables(
  rows: string[][] = STATEMENT_ROWS,
  totalIn = '+ 260,00',
  totalOut = '- 230,00',
): SheetTable[] {
  return [{ name: 'Página 1', rows: [...statementHeader(totalIn, totalOut), ...rows] }];
}

describe('parseInfinitePayStatement', () => {
  it('classifica cada movimento pelo que ele é', () => {
    const { rows, skipped } = parseInfinitePayStatement(statementTables(), options);

    expect(skipped).toHaveLength(0);
    // 5 linhas: 4 de resultado e a retirada da titular, que é gravada fora do DRE.
    expect(rows).toHaveLength(5);

    const pix = rows.find((row) => row.description.includes('MARIA SOUZA'));
    expect(pix?.type).toBe('receita');
    expect(pix?.grossAmount).toBe(100);
    expect(pix?.paymentMethod).toBe('pix');
    expect(pix?.category).toBe('Recebimentos Pix');
    expect(pix?.status).toBe('liquidada');
    // Extrato é dinheiro já na conta: liquida na data do movimento, alimentando o caixa.
    expect(pix?.settledAt?.toISOString()).toBe('2026-10-01T09:00:00.000Z');

    const deposit = rows.find((row) => row.category === 'Vendas na maquininha');
    expect(deposit?.type).toBe('receita');
    expect(deposit?.grossAmount).toBe(60);
    expect(deposit?.paymentMethod).toBe('credito');
    // O repasse já vem líquido de tarifa, então não há taxa a aplicar sobre ele.
    expect(deposit?.paymentFeeRate).toBe(0);

    const expense = rows.find((row) => row.category === 'Pagamentos Pix');
    expect(expense?.type).toBe('despesa');
    expect(expense?.grossAmount).toBe(80);
    expect(expense?.description).toContain('FORNECEDOR ESMALTES LTDA');
    // Pix para terceiro é despesa de verdade e conta no DRE.
    expect(expense?.countsInDre).not.toBe(false);
  });

  it('herda a data do dia nas linhas que só têm hora', () => {
    const { rows } = parseInfinitePayStatement(statementTables(), options);
    const second = rows.find((row) => row.category === 'Vendas na maquininha');
    expect(second?.occurredAt.toISOString()).toBe('2026-10-01T10:00:00.000Z');
    const nextDay = rows.find((row) => row.description.includes('ANA LIMA'));
    expect(nextDay?.occurredAt.toISOString()).toBe('2026-10-02T08:00:00.000Z');
  });

  it('grava a retirada da titular fora do DRE, e não como despesa', () => {
    const { rows, asides } = parseInfinitePayStatement(statementTables(), options);

    // A linha existe: é dela que sai o "Saldo Retirado" da auditoria.
    const withdrawal = rows.find((row) => row.category === 'Retiradas para a conta do salão');
    expect(withdrawal?.grossAmount).toBe(150);
    expect(withdrawal?.occurredAt.toISOString()).toBe('2026-10-02T18:00:00.000Z');
    // Mas fica fora do resultado: é troca de bolso, não despesa do salão.
    expect(withdrawal?.countsInDre).toBe(false);

    expect(asides).toHaveLength(1);
    expect(asides[0]?.count).toBe(1);
    expect(asides[0]?.amount).toBe(-150);
    expect(asides[0]?.label).toContain('Retiradas');
  });

  it('não aplica comissão: o extrato não diz quem atendeu', () => {
    const { rows } = parseInfinitePayStatement(statementTables(), options);
    expect(rows.every((row) => row.professionalCommissionRate === 0)).toBe(true);
  });

  it('recusa o arquivo quando a leitura não fecha com os totais do documento', () => {
    // O documento declara entradas de 999,00, mas as linhas somam 260,00.
    expect(() => parseInfinitePayStatement(statementTables(STATEMENT_ROWS, '+ 999,00'), options))
      .toThrow(/não fecha com os totais/);
  });

  it('recusa quando o saldo final não bate com saldo inicial mais movimentações', () => {
    const tables: SheetTable[] = [{
      name: 'Página 1',
      rows: [...statementHeader('+ 260,00', '- 230,00', '+ 100,00', '+ 999,00'), ...STATEMENT_ROWS],
    }];
    expect(() => parseInfinitePayStatement(tables, options)).toThrow(/saldo do extrato não fecha/);
  });

  it('importa as duas linhas quando dois movimentos iguais caem no mesmo minuto', () => {
    // Sem bloco de resumo não há totais a conferir, então a leitura passa direto.
    const tables: SheetTable[] = [{
      name: 'Página 1',
      rows: [
        ['Data', 'Hora', 'Tipo de transação', 'Nome', 'Detalhe', 'Valor (R$)'],
        ['05 Out, 2026', '14:30', 'Pix', 'Pix ANA LIMA', 'Recebido', '+40,00'],
        ['14:30', 'Pix', 'Pix ANA LIMA', 'Recebido', '+40,00'],
      ],
    }];
    const { rows } = parseInfinitePayStatement(tables, options);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.externalId).not.toBe(rows[1]?.externalId);
  });

  it('avisa quando não encontra movimentação alguma', () => {
    const tables: SheetTable[] = [{
      name: 'Página 1',
      rows: [['Relatório de movimentações'], ['Página 1 de 1']],
    }];
    expect(() => parseInfinitePayStatement(tables, options)).toThrow(/não encontrei movimenta/i);
  });
});

describe('readPdf', () => {
  it('reconhece a assinatura do formato', () => {
    expect(isPdf(Buffer.from('%PDF-1.4\n'))).toBe(true);
    expect(isPdf(Buffer.from('PK\u0003\u0004'))).toBe(false);
  });

  it('recusa um .pdf que não é PDF', () => {
    expect(() => readReport(Buffer.from('data;valor\n1;2\n'), 'extrato.pdf'))
      .toThrow(/conteúdo não é um PDF/);
  });

  it('lê o extrato real e associa cada nome à linha certa', () => {
    const fixture = loadStatementFixture();
    if (!fixture) return;

    const pages = readReport(fixture, 'relatorio.pdf');
    expect(pages).toHaveLength(10);

    const rows = pages.flatMap((page) => page.rows);
    // A coluna "Nome" é desenhada em bloco, fora da ordem de leitura: se a reconstrução
    // seguisse a ordem do stream, o nome cairia em outra linha.
    const first = rows.find((row) => row[0] === '01 Out, 2026');
    expect(first).toEqual([
      '01 Out, 2026', '02:03', 'Pix', 'Pix ANABELLE C CASARINI SILVA', 'Recebido', '+40,00',
    ]);

    // A fonte usa a ligadura "ﬁ" no lugar de "fi"; o leitor devolve as duas letras.
    expect(rows.some((row) => row.some((cell) => cell.includes('Depósito InfinitePay')))).toBe(true);
    expect(rows.every((row) => row.every((cell) => !cell.includes('ﬁ')))).toBe(true);
  });
});

describe('parseInfinitePayStatement com o extrato real', () => {
  it('lê as 98 movimentações e fecha com os totais declarados no PDF', () => {
    const fixture = loadStatementFixture();
    if (!fixture) return;

    const tables = readReport(fixture, 'relatorio.pdf');
    const { rows, skipped, asides } = parseInfinitePayStatement(tables, options);

    expect(skipped).toHaveLength(0);
    // 98 movimentos: 90 de resultado e 8 retiradas da titular, todas gravadas.
    expect(rows).toHaveLength(98);
    expect(asides[0]?.count).toBe(8);
    expect(asides[0]?.amount).toBeCloseTo(-6122.28, 2);

    const withdrawals = rows.filter((row) => row.countsInDre === false);
    expect(withdrawals).toHaveLength(8);
    expect(withdrawals.reduce((total, row) => total + row.grossAmount, 0)).toBeCloseTo(6122.28, 2);

    const income = rows.filter((row) => row.type === 'receita' && row.countsInDre !== false);
    expect(income).toHaveLength(90);
    // Confere com o "Total de entradas" impresso no relatório.
    expect(income.reduce((total, row) => total + row.grossAmount, 0)).toBeCloseTo(6938.28, 2);

    const byCategory = new Map<string, number>();
    for (const row of rows) byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + 1);
    expect(byCategory.get('Recebimentos Pix')).toBe(79);
    expect(byCategory.get('Vendas na maquininha')).toBe(11);

    expect(rows[0]?.occurredAt.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(rows[rows.length - 1]?.occurredAt.toISOString().slice(0, 10)).toBe('2026-11-01');
  });
});
