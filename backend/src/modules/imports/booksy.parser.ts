// Converte a exportação "business-performance-report" do Booksy em receitas do estúdio.
//
// O Booksy é a fonte da RECEITA: diz o que foi vendido, para quem e por qual profissional.
// A aba usada é "Lista de agendamentos" (uma linha por atendimento); as abas de resumo
// ("Relatório de Vendas", "Resumo Executivo") são agregados e não servem para lançamento.
//
// Layout observado na exportação real (cabeçalho na linha 5):
//   Data e hora | ID da Reserva | Categoria principal | Serviço | Cliente | Funcionário |
//   Comprimento do serviço | Valor dos serviços | Valor dos complementos | Receita líquida |
//   Desconto | Taxa | Valor do troco | Receita total | Status
import { AppError } from '../../shared/utils/app-error.js';
import type { PaymentMethod, Professional } from '../../models/transaction.model.js';
import type { ParseOptions, ParseOutcome, ParsedRow, SheetTable, SkippedRow } from './import.types.js';
import { looksLike } from './report.reader.js';
import { normalizeHeader } from './spreadsheet.reader.js';
import { cellAmount, cellDate, cellText, findSheet, isBlankRow, locateTable } from './table-locator.js';

const APPOINTMENT_SHEETS = ['Lista de agendamentos', 'Lista de visitas', 'Appointments list'] as const;

const COLUMNS = {
  occurredAt: ['data e hora', 'data', 'data do atendimento', 'date and time'],
  externalId: ['id da reserva', 'id do agendamento', 'id', 'booking id'],
  category: ['categoria principal', 'categoria', 'main category'],
  description: ['servico', 'nome do servico', 'service'],
  professional: ['funcionario', 'profissional', 'staff member', 'colaborador'],
  serviceAmount: ['valor dos servicos', 'valor das reservas', 'valor do servico'],
  addonAmount: ['valor dos complementos', 'complementos'],
  netRevenue: ['receita liquida'],
  discount: ['desconto', 'descontos'],
  fee: ['taxa', 'taxas'],
  totalRevenue: ['receita total', 'total'],
  status: ['status', 'situacao'],
} as const;

const REQUIRED = ['occurredAt', 'description', 'professional'] as const;

/**
 * Nomes como aparecem no Booksy -> enum do modelo. Mapear pelo primeiro nome evita
 * depender do sobrenome, que a dona pode editar no cadastro da plataforma.
 */
const PROFESSIONAL_ALIASES: ReadonlyArray<{ matches: readonly string[]; professional: Professional }> = [
  { matches: ['nicolle', 'nicole'], professional: 'Nicolle' },
  { matches: ['stefany', 'stephany', 'stefanie', 'stephanie', 'stefani'], professional: 'Stefany' },
];

/** O Booksy não informa a forma de pagamento no relatório de agendamentos. */
const BOOKSY_PAYMENT_METHOD: PaymentMethod = 'nao_informado';

export function resolveProfessional(raw: string): Professional | null {
  const normalized = normalizeHeader(raw);
  if (!normalized) return null;
  const firstName = normalized.split(' ')[0] ?? normalized;
  const match = PROFESSIONAL_ALIASES.find(
    (alias) => alias.matches.includes(firstName) || alias.matches.some((name) => normalized.includes(name)),
  );
  return match?.professional ?? null;
}

/**
 * "Concluída" significa atendimento prestado e pago no balcão, então entra como liquidada
 * com settledAt na data do atendimento — é o que alimenta o Fluxo de Caixa.
 */
function resolveStatus(raw: string): ParsedRow['status'] {
  const normalized = normalizeHeader(raw);
  if (!normalized) return 'pendente';
  if (normalized.includes('cancel') || normalized.includes('no show') || normalized.includes('faltou')) {
    return 'cancelada';
  }
  if (normalized.includes('conclu') || normalized.includes('finaliz') || normalized.includes('complet')) {
    return 'liquidada';
  }
  return 'pendente';
}

export function parseBooksyReport(tables: SheetTable[], options: ParseOptions): ParseOutcome {
  const sheet = findSheet(tables, APPOINTMENT_SHEETS)
    ?? tables.find((table) => table.rows.some((row) => row.some((cell) => normalizeHeader(cell) === 'id da reserva')));

  if (!sheet) {
    if (looksLike(tables) === 'infinitepay') {
      throw new AppError(
        'Este arquivo é o extrato da InfinitePay, não o relatório do Booksy. '
          + 'Troque os dois de campo: o do Booksy é o dos atendimentos.',
        400,
        'FILES_SWAPPED',
      );
    }
    throw new AppError(
      'Não encontrei a aba "Lista de agendamentos" no relatório do Booksy. '
        + `Abas do arquivo: ${tables.map((table) => table.name).join(' | ')}.`,
      400,
      'BOOKSY_SHEET_NOT_FOUND',
    );
  }

  const table = locateTable(sheet, COLUMNS, REQUIRED);
  const rows: ParsedRow[] = [];
  const skipped: SkippedRow[] = [];
  const seen = new Set<string>();

  table.dataRows.forEach((row, offset) => {
    const line = table.headerLine + offset + 1;
    if (isBlankRow(row)) return;

    const description = cellText(row, table.columns.get('description'));
    const occurredAt = cellDate(row, table.columns.get('occurredAt'));
    // A linha "Total" no fim da tabela não tem data: é rodapé, não atendimento.
    if (!occurredAt) {
      if (description) skipped.push({ line, reason: `Data do atendimento ilegível em "${description}".` });
      return;
    }
    if (!description) {
      skipped.push({ line, reason: 'Linha sem nome de serviço.' });
      return;
    }

    // Nome desconhecido NÃO descarta o atendimento: o dinheiro é real de qualquer
    // forma, e descartar fazia o mês inteiro sumir quando o relatório vinha com um nome
    // que o sistema não conhece. A linha entra sem profissional atribuída — só não
    // aparece na divisão de receitas por pessoa.
    //
    // Antes isso barrava a linha porque a comissão dependia de saber quem atendeu; o
    // estúdio não trabalha mais com comissão, então a atribuição virou informação.
    const professional = resolveProfessional(cellText(row, table.columns.get('professional')));

    const serviceAmount = cellAmount(row, table.columns.get('serviceAmount')) ?? 0;
    const addonAmount = cellAmount(row, table.columns.get('addonAmount')) ?? 0;
    const totalRevenue = cellAmount(row, table.columns.get('totalRevenue'));
    const discountRaw = Math.abs(cellAmount(row, table.columns.get('discount')) ?? 0);
    const feeAmount = Math.abs(cellAmount(row, table.columns.get('fee')) ?? 0);

    // Quando as colunas de detalhe vêm vazias, reconstrói o bruto a partir do total + desconto.
    const grossAmount = Math.abs(serviceAmount + addonAmount) || Math.abs((totalRevenue ?? 0) + discountRaw);
    if (grossAmount <= 0) {
      skipped.push({ line, reason: `"${description}" não tem valor de serviço.` });
      return;
    }

    // O CalculationService recusa desconto maior que o bruto; a planilha às vezes traz
    // cortesia lançada como desconto cheio, então limita em vez de derrubar a importação.
    const discountAmount = Math.min(discountRaw, grossAmount);
    const baseAmount = grossAmount - discountAmount;
    const paymentFeeRate = baseAmount > 0 && feeAmount > 0 ? Math.min(feeAmount / baseAmount, 1) : 0;

    const status = resolveStatus(cellText(row, table.columns.get('status')));

    // Cancelamento e falta não entram: não houve atendimento e não houve dinheiro. Antes
    // eram gravados com status 'cancelada' e, embora o resumo do mês já os ignorasse, o
    // total do lote no histórico os somava — o arquivo de agosto aparecia como
    // R$ 2.830,00 quando o vendido foi R$ 2.230,00.
    if (status === 'cancelada') {
      skipped.push({ line, reason: `"${description}" foi cancelado ou não compareceu.` });
      return;
    }

    // Na exportação atual "Receita total" é sempre serviços + complementos − desconto.
    // Se o Booksy mudar essa conta, é melhor a linha aparecer como ignorada do que
    // entrar no caixa com um valor que não bate com o relatório da plataforma.
    if (totalRevenue !== null && Math.abs(totalRevenue - baseAmount) > 0.01) {
      skipped.push({
        line,
        reason: `"${description}": receita total (${totalRevenue.toFixed(2)}) não confere com`
          + ` valor menos desconto (${baseAmount.toFixed(2)}). Confira a linha no Booksy.`,
      });
      return;
    }

    const externalId = cellText(row, table.columns.get('externalId'))
      || `${occurredAt.toISOString()}-${normalizeHeader(description)}`;

    if (seen.has(externalId)) {
      skipped.push({ line, reason: `Agendamento ${externalId} repetido no próprio arquivo.` });
      return;
    }
    seen.add(externalId);

    rows.push({
      externalId,
      type: 'receita',
      description,
      category: cellText(row, table.columns.get('category')) || 'Serviços',
      ...(professional ? { professional } : {}),
      grossAmount,
      discountAmount,
      paymentFeeRate,
      professionalCommissionRate: options.defaultCommissionRate,
      paymentMethod: BOOKSY_PAYMENT_METHOD,
      occurredAt,
      status,
      ...(status === 'liquidada' ? { settledAt: occurredAt } : {}),
    });
  });

  return { rows, skipped, asides: [] };
}
