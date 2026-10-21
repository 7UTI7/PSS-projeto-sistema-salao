// Camada HTTP dos relatórios: valida o período e chama o ReportService.
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ReportService } from '../modules/reports/report.service.js';
import { AppError } from '../shared/utils/app-error.js';

const dateQuerySchema = z.object({ start: z.string().datetime(), end: z.string().datetime() });

export class ReportController {
  constructor(private readonly reportService = new ReportService()) {}

  async dre(request: Request, response: Response): Promise<void> {
    const range = this.parseRange(request);
    const data = await this.reportService.getDre(range);
    response.json({ status: 'success', data });
  }

  async cashFlow(request: Request, response: Response): Promise<void> {
    const range = this.parseRange(request);
    const data = await this.reportService.getCashFlow(range);
    response.json({ status: 'success', data });
  }

  private parseRange(request: Request): { start: Date; end: Date } {
    const query = dateQuerySchema.safeParse(request.query);
    if (!query.success) throw new AppError('Informe start e end como datas ISO 8601.', 400, 'INVALID_DATE_RANGE');
    return this.reportService.validateRange(query.data.start, query.data.end);
  }
}