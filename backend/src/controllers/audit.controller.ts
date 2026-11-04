// Camada HTTP da auditoria: recebe os dois relatórios juntos, importa e confronta.
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuditService, periodOf } from '../modules/audits/audit.service.js';
import { ImportService } from '../modules/imports/import.service.js';
import { AppError } from '../shared/utils/app-error.js';
import type { AuthenticatedUser } from '../modules/auth/auth.types.js';
import type { ImportResult } from '../modules/imports/import.types.js';

const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const submitSchema = z.object({
  defaultCommissionRate: z.coerce.number().min(0).max(1).default(0),
});

/**
 * O lançamento que justifica a diferença. `direction` e `type` são opcionais porque o
 * motivo já os determina — só "outro" obriga a dona a dizer.
 */
const entrySchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  reason: z.enum(['dinheiro', 'taxa', 'gorjeta', 'estorno', 'outro']),
  description: z.string().trim().min(1).max(240),
  direction: z.enum(['faltou_entrar', 'entrou_a_mais']).optional(),
  type: z.enum(['receita', 'despesa']).optional(),
  occurredAt: z.coerce.date().optional(),
});

/**
 * O nome chega do seletor de arquivos do celular, que entrega o acento percent-encoded
 * ("relato%CC%81rio.pdf") e em NFD. Sem normalizar, o histórico mostra o nome cru.
 */
function normalizeFileName(name: string): string {
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    // Nome com '%' literal não é URI válida; nesse caso vale o original.
  }
  return decoded.normalize('NFC');
}

export class AuditController {
  constructor(
    private readonly auditService = new AuditService(),
    private readonly importService = new ImportService(),
  ) {}

  /** Estado recalculado de um mês. Alimenta a tela de Importar e o Painel. */
  async show(request: Request, response: Response): Promise<void> {
    const period = periodSchema.safeParse(request.query['period']);
    if (!period.success) throw new AppError('Informe o mês no formato AAAA-MM.', 400, 'INVALID_PERIOD');

    const data = await this.auditService.getSummary(period.data);
    response.json({ status: 'success', data });
  }

  /**
   * Os dois relatórios no mesmo envio. Importa um, importa o outro e devolve a auditoria
   * de cada mês que os arquivos tocaram.
   *
   * Se o segundo falhar, o primeiro é desfeito: meia submissão deixaria um mês com uma
   * fonte só, que é exatamente o estado que a auditoria existe para impedir.
   */
  async submit(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED');
    const actor = request.user;

    const body = submitSchema.safeParse(request.body);
    if (!body.success) {
      throw new AppError('Comissão padrão deve ser um número entre 0 e 1.', 400, 'VALIDATION_ERROR');
    }

    const files = request.files as Record<string, Express.Multer.File[]> | undefined;
    const booksyFile = files?.['booksy']?.[0];
    const infinitepayFile = files?.['infinitepay']?.[0];
    if (!booksyFile || !infinitepayFile) {
      throw new AppError(
        'Envie os dois relatórios: o do Booksy no campo "booksy" e o da InfinitePay no campo "infinitepay".',
        400,
        'BOTH_FILES_REQUIRED',
      );
    }

    const booksy = await this.importService.process(
      {
        source: 'booksy',
        defaultCommissionRate: body.data.defaultCommissionRate,
        originalName: normalizeFileName(booksyFile.originalname),
        buffer: booksyFile.buffer,
      },
      actor,
    );

    let infinitepay: ImportResult;
    try {
      infinitepay = await this.importService.process(
        {
          source: 'infinitepay',
          defaultCommissionRate: body.data.defaultCommissionRate,
          originalName: normalizeFileName(infinitepayFile.originalname),
          buffer: infinitepayFile.buffer,
        },
        actor,
      );
    } catch (error: unknown) {
      await this.importService.rollback(booksy.batchId);
      throw error;
    }

    const audits = await this.registerTouchedPeriods(booksy, infinitepay, actor);

    response.status(201).json({
      status: 'success',
      data: { booksy, infinitepay, audits },
    });
  }

  /** O Lançamento Manual que zera a diferença, seguido da auditoria recalculada. */
  async addEntry(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED');

    const period = periodSchema.safeParse(request.params['period']);
    if (!period.success) throw new AppError('Informe o mês no formato AAAA-MM.', 400, 'INVALID_PERIOD');

    const body = entrySchema.safeParse(request.body);
    if (!body.success) {
      throw new AppError(
        'Informe o valor (maior que zero), o motivo e uma descrição.',
        400,
        'VALIDATION_ERROR',
      );
    }

    const data = await this.auditService.addAdjustment(period.data, body.data, request.user);
    response.status(201).json({ status: 'success', data });
  }

  /**
   * Um arquivo pode cobrir mais de um mês — o extrato real vai de 01/10 a 01/11. Cada mês
   * tocado ganha a sua auditoria, porque é o mês, não o arquivo, que fecha ou não fecha.
   */
  private async registerTouchedPeriods(
    booksy: ImportResult,
    infinitepay: ImportResult,
    actor: AuthenticatedUser,
  ) {
    const periods = new Map<string, { booksyBatchId?: string; infinitepayBatchId?: string }>();

    for (const [result, key] of [
      [booksy, 'booksyBatchId'],
      [infinitepay, 'infinitepayBatchId'],
    ] as const) {
      for (const period of monthsBetween(result.periodStart, result.periodEnd)) {
        const current = periods.get(period) ?? {};
        current[key] = result.batchId;
        periods.set(period, current);
      }
    }

    const summaries = [];
    for (const [period, batches] of [...periods.entries()].sort()) {
      summaries.push(await this.auditService.register(period, batches, actor));
    }
    return summaries;
  }
}

/** Todos os meses de um intervalo, inclusive, em UTC. */
function monthsBetween(start: Date | null, end: Date | null): string[] {
  if (!start || !end) return [];

  const months: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= last) {
    months.push(periodOf(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}
