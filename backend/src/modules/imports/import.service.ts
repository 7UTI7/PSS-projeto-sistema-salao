// Orquestra a importação de relatórios: lê o arquivo, normaliza, deduplica e grava o lote.
//
// Divisão de papéis entre as duas fontes (detalhada em cada parser):
//   Booksy      -> o que foi VENDIDO: serviço, profissional, desconto. Base da comissão.
//   InfinitePay -> o DINHEIRO que entrou e saiu da conta, já liquidado.
//
// As duas são em boa parte o mesmo dinheiro visto em momentos diferentes: o Booksy pela
// competência (quando o serviço foi prestado), o extrato pelo caixa (quando o valor caiu na
// conta). Importar as duas para um período que se sobrepõe, portanto, conta a mesma receita
// duas vezes — é o que o aviso de sobreposição alerta antes de confirmar.
import { createHash } from 'node:crypto';
import { Category } from '../../models/category.model.js';
import { ImportBatch } from '../../models/import-batch.model.js';
import { Transaction } from '../../models/transaction.model.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../../shared/utils/app-error.js';
import { CalculationService } from '../transactions/calculation.service.js';
import { parseBooksyReport } from './booksy.parser.js';
import { parseInfinitePayStatement } from './infinitepay.parser.js';
import { readReport } from './report.reader.js';
import type {
  ImportPreview,
  ImportResult,
  ImportSource,
  ImportTotals,
  ParseOptions,
  ParseOutcome,
  ParsedRow,
} from './import.types.js';

const calculationService = new CalculationService();

/** Limite de linhas por arquivo: protege a memória do servidor e o tamanho do documento do lote. */
const MAX_ROWS_PER_FILE = 5_000;

export interface UploadedFile {
  originalName: string;
  buffer: Buffer;
}

export interface ImportInput extends UploadedFile {
  source: ImportSource;
  defaultCommissionRate: number;
}

function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function emptyTotals(): ImportTotals {
  return {
    grossAmount: 0,
    discountAmount: 0,
    feeAmount: 0,
    commissionAmount: 0,
    netAmount: 0,
    studioNetProfit: 0,
  };
}

export class ImportService {
  /** Lê e normaliza o arquivo sem gravar nada: é o que a tela mostra antes de confirmar. */
  async preview(input: ImportInput): Promise<ImportPreview> {
    const { contentHash, outcome } = this.parse(input);
    const existing = await ImportBatch.findOne({
      contentHash,
      status: 'processed',
      deletedAt: null,
    }).select('_id').lean();

    const categories = [...new Set(outcome.rows.map((row) => row.category))];
    const known = await Category.find({ name: { $in: categories }, deletedAt: null })
      .collation({ locale: 'pt', strength: 2 })
      .select('name')
      .lean();
    const knownNames = new Set(known.map((category) => category.name.toLowerCase()));
    const summary = this.summarize(outcome.rows);

    return {
      source: input.source,
      fileName: input.originalName,
      contentHash,
      alreadyImported: existing !== null,
      rowCount: outcome.rows.length,
      skipped: outcome.skipped,
      asides: outcome.asides,
      ...summary,
      missingCategories: categories.filter((name) => !knownNames.has(name.toLowerCase())),
      warnings: await this.overlapWarnings(input.source, summary.periodStart, summary.periodEnd),
      rows: outcome.rows,
    };
  }

  /**
   * Avisa quando o período deste arquivo encosta em um lote já importado da outra origem.
   * Booksy e extrato descrevem o mesmo dinheiro (venda x recebimento), então somar os dois
   * no mesmo mês dobra o faturamento. Não é bloqueio: os arquivos podem ser de meses
   * diferentes, e a dona pode ter motivo para querer os dois.
   */
  private async overlapWarnings(
    source: ImportSource,
    periodStart: Date | null,
    periodEnd: Date | null,
  ): Promise<string[]> {
    if (!periodStart || !periodEnd) return [];

    const other = await ImportBatch.findOne({
      source: { $ne: source },
      status: 'processed',
      deletedAt: null,
      periodStart: { $lte: periodEnd },
      periodEnd: { $gte: periodStart },
    }).select('source fileName periodStart periodEnd').lean();
    if (!other) return [];

    const day = (date: Date | null | undefined): string =>
      date ? date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '?';
    const otherLabel = other.source === 'booksy' ? 'do Booksy' : 'da InfinitePay';

    return [
      `O período deste arquivo (${day(periodStart)} a ${day(periodEnd)}) se sobrepõe ao lote `
        + `${otherLabel} "${other.fileName}" (${day(other.periodStart)} a ${day(other.periodEnd)}). `
        + 'O Booksy registra a venda e o extrato registra o recebimento do mesmo atendimento, '
        + 'então importar os dois conta essa receita duas vezes. Importe apenas se os arquivos '
        + 'tratarem de movimentos diferentes.',
    ];
  }

  /** Processa de verdade: cria as categorias que faltam, grava o lote e os lançamentos. */
  async process(input: ImportInput, actor: AuthenticatedUser): Promise<ImportResult> {
    const { contentHash, outcome } = this.parse(input);

    const duplicateBatch = await ImportBatch.findOne({
      contentHash,
      status: 'processed',
      deletedAt: null,
    }).select('fileName createdAt').lean();
    if (duplicateBatch) {
      throw new AppError(
        `Este arquivo já foi importado em ${duplicateBatch.createdAt.toLocaleDateString('pt-BR')}`
          + ` como "${duplicateBatch.fileName}". Desfaça o lote antes de reenviar.`,
        409,
        'DUPLICATE_IMPORT',
      );
    }

    if (outcome.rows.length === 0) {
      throw new AppError(
        'Nenhuma linha aproveitável no arquivo. Confira o resumo de linhas ignoradas.',
        400,
        'NOTHING_TO_IMPORT',
      );
    }

    const summary = this.summarize(outcome.rows);
    const batch = await ImportBatch.create({
      source: input.source,
      fileName: input.originalName,
      contentHash,
      rawPayload: outcome.rows,
      status: 'received',
      skippedCount: outcome.skipped.length,
      ...(summary.periodStart ? { periodStart: summary.periodStart } : {}),
      ...(summary.periodEnd ? { periodEnd: summary.periodEnd } : {}),
      totals: summary.totals,
      createdBy: actor.id,
    });

    try {
      const createdCategories = await this.ensureCategories(outcome.rows);
      const { importedCount, duplicateCount } = await this.insertTransactions(
        outcome.rows,
        input.source,
        batch.id,
        actor,
      );

      batch.status = 'processed';
      batch.importedCount = importedCount;
      batch.duplicateCount = duplicateCount;
      await batch.save();

      return {
        batchId: batch.id,
        source: input.source,
        fileName: input.originalName,
        importedCount,
        duplicateCount,
        skipped: outcome.skipped,
        asides: outcome.asides,
        createdCategories,
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
        totals: summary.totals,
      };
    } catch (error: unknown) {
      // Um lote parcialmente gravado é pior do que nenhum: desfaz o que entrou e marca a falha.
      await Transaction.deleteMany({ importBatchId: batch.id });
      batch.status = 'failed';
      batch.errorMessage = error instanceof Error ? error.message.slice(0, 500) : 'Erro desconhecido.';
      await batch.save();
      throw error;
    }
  }

  async list(limit = 50): Promise<unknown[]> {
    return ImportBatch.find({ deletedAt: null })
      .select('source fileName status importedCount duplicateCount skippedCount periodStart periodEnd totals errorMessage createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Desfaz um lote: os lançamentos vão para a lixeira (soft delete) e perdem o externalId,
   * para que o índice único não impeça reenviar o arquivo corrigido.
   */
  async rollback(batchId: string): Promise<{ removedCount: number }> {
    const batch = await ImportBatch.findOne({ _id: batchId, deletedAt: null });
    if (!batch) throw new AppError('Lote de importação não encontrado.', 404, 'NOT_FOUND');
    if (batch.status === 'rolled_back') {
      throw new AppError('Este lote já foi desfeito.', 409, 'ALREADY_ROLLED_BACK');
    }

    const result = await Transaction.updateMany(
      { importBatchId: batch.id, deletedAt: null },
      { $set: { deletedAt: new Date() }, $unset: { externalId: 1 } },
    );

    batch.status = 'rolled_back';
    await batch.save();
    return { removedCount: result.modifiedCount };
  }

  // -------------------------------------------------------------------------

  private parse(input: ImportInput): { contentHash: string; outcome: ParseOutcome } {
    const contentHash = createHash('sha256').update(input.buffer).digest('hex');
    const tables = readReport(input.buffer, input.originalName);
    const options: ParseOptions = { defaultCommissionRate: input.defaultCommissionRate };

    const outcome = input.source === 'booksy'
      ? parseBooksyReport(tables, options)
      : parseInfinitePayStatement(tables, options);

    if (outcome.rows.length > MAX_ROWS_PER_FILE) {
      throw new AppError(
        `O arquivo tem ${outcome.rows.length} linhas; o limite por importação é ${MAX_ROWS_PER_FILE}. `
          + 'Exporte por períodos menores.',
        413,
        'IMPORT_TOO_LARGE',
      );
    }

    return { contentHash, outcome };
  }

  private summarize(rows: readonly ParsedRow[]): {
    periodStart: Date | null;
    periodEnd: Date | null;
    totals: ImportTotals;
  } {
    const totals = emptyTotals();
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;

    for (const row of rows) {
      if (!periodStart || row.occurredAt < periodStart) periodStart = row.occurredAt;
      if (!periodEnd || row.occurredAt > periodEnd) periodEnd = row.occurredAt;

      const calculation = this.calculate(row);
      totals.grossAmount += row.grossAmount;
      totals.discountAmount += row.discountAmount;
      totals.feeAmount += calculation.feeAmount;
      totals.commissionAmount += calculation.commissionAmount;
      totals.netAmount += calculation.netAmount;
      totals.studioNetProfit += calculation.studioNetProfit;
    }

    for (const key of Object.keys(totals) as (keyof ImportTotals)[]) {
      totals[key] = roundCurrency(totals[key]);
    }

    return { periodStart, periodEnd, totals };
  }

  /** Mesma regra do lançamento manual: despesa não tem taxa nem comissão. */
  private calculate(row: ParsedRow) {
    if (row.type === 'despesa') {
      return {
        feeAmount: 0,
        commissionAmount: 0,
        netAmount: row.grossAmount,
        studioNetProfit: -row.grossAmount,
      };
    }
    return calculationService.calculate({
      grossAmount: row.grossAmount,
      discountAmount: row.discountAmount,
      paymentFeeRate: row.paymentFeeRate,
      professionalCommissionRate: row.professionalCommissionRate,
    });
  }

  /**
   * As categorias do Booksy ("Unhas", "Sobrancelhas") não existem no catálogo na primeira
   * importação. Criá-las é melhor do que recusar o arquivo inteiro; a dona depois renomeia
   * ou desativa o que não quiser na tela de categorias.
   */
  private async ensureCategories(rows: readonly ParsedRow[]): Promise<string[]> {
    // A natureza da categoria vem do lançamento que a usa, não da origem do arquivo: o
    // extrato da InfinitePay produz receitas (Pix recebido) e despesas (Pix enviado) no
    // mesmo arquivo.
    const kinds = new Map<string, 'receita' | 'despesa'>();
    for (const row of rows) {
      if (!kinds.has(row.category)) kinds.set(row.category, row.type);
    }

    const wanted = [...kinds.keys()];
    const existing = await Category.find({ name: { $in: wanted }, deletedAt: null })
      .collation({ locale: 'pt', strength: 2 })
      .select('name active kind')
      .lean();
    const byName = new Map(existing.map((category) => [category.name.toLowerCase(), category]));
    const created: string[] = [];

    for (const name of wanted) {
      const found = byName.get(name.toLowerCase());
      if (found) {
        if (!found.active) {
          throw new AppError(
            `A categoria "${found.name}" está inativa no catálogo. Reative-a antes de importar.`,
            400,
            'INACTIVE_CATEGORY',
          );
        }
        continue;
      }

      await Category.create({ name, kind: kinds.get(name) ?? 'receita', active: true });
      created.push(name);
    }

    return created;
  }

  private async insertTransactions(
    rows: readonly ParsedRow[],
    source: ImportSource,
    batchId: string,
    actor: AuthenticatedUser,
  ): Promise<{ importedCount: number; duplicateCount: number }> {
    // Linhas já presentes de uma importação anterior (arquivos com períodos sobrepostos).
    const externalIds = rows.map((row) => row.externalId);
    const known = await Transaction.find({ origin: source, externalId: { $in: externalIds }, deletedAt: null })
      .select('externalId')
      .lean();
    const knownIds = new Set(known.map((transaction) => transaction.externalId));

    const documents = rows
      .filter((row) => !knownIds.has(row.externalId))
      .map((row) => {
        const calculation = this.calculate(row);
        return {
          type: row.type,
          description: row.description.slice(0, 240),
          grossAmount: roundCurrency(row.grossAmount),
          discountAmount: roundCurrency(row.discountAmount),
          feeAmount: calculation.feeAmount,
          professional: row.professional,
          commissionAmount: calculation.commissionAmount,
          studioNetProfit: calculation.studioNetProfit,
          netAmount: calculation.netAmount,
          category: row.category,
          ...(row.type === 'despesa' ? { costType: 'variavel' as const } : {}),
          paymentMethod: row.paymentMethod,
          occurredAt: row.occurredAt,
          ...(row.settledAt ? { settledAt: row.settledAt } : {}),
          status: row.status,
          origin: source,
          importBatchId: batchId,
          externalId: row.externalId,
          createdBy: actor.id,
        };
      });

    // `insertedCount` vem do retorno do insert, não do tamanho do lote preparado: o
    // número que a tela mostra como "importado(s)" é o de linhas realmente gravadas.
    const inserted = documents.length > 0
      ? await Transaction.insertMany(documents, { ordered: false })
      : [];

    return {
      importedCount: inserted.length,
      duplicateCount: rows.length - documents.length,
    };
  }
}
