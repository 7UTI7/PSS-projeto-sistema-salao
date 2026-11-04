// Camada HTTP das importações: valida o arquivo e os campos do formulário e chama o ImportService.
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ImportService, type ImportInput } from '../modules/imports/import.service.js';
import { AppError } from '../shared/utils/app-error.js';

/**
 * Campos que acompanham o arquivo. Vêm de um multipart/form-data, então chegam
 * sempre como texto — daí o coerce na alíquota de comissão.
 */
const uploadSchema = z.object({
  source: z.enum(['booksy', 'infinitepay']),
  defaultCommissionRate: z.coerce.number().min(0).max(1).default(0),
});

const idSchema = z.string().regex(/^[a-f\d]{24}$/i);

export class ImportController {
  constructor(private readonly importService = new ImportService()) {}

  async preview(request: Request, response: Response): Promise<void> {
    const data = await this.importService.preview(this.parseUpload(request));
    // As linhas normalizadas só interessam ao processamento; a tela usa o resumo.
    const { rows: _rows, ...summary } = data;
    void _rows;
    response.json({ status: 'success', data: summary });
  }

  async process(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED');
    const data = await this.importService.process(this.parseUpload(request), request.user);
    response.status(201).json({ status: 'success', data });
  }

  async list(_request: Request, response: Response): Promise<void> {
    const data = await this.importService.list();
    response.json({ status: 'success', data });
  }

  async rollback(request: Request, response: Response): Promise<void> {
    const id = idSchema.safeParse(request.params['id']);
    if (!id.success) throw new AppError('Identificador inválido.', 400, 'INVALID_ID');
    const data = await this.importService.rollback(id.data);
    response.json({ status: 'success', data });
  }

  private parseUpload(request: Request): ImportInput {
    const file = request.file;
    if (!file) throw new AppError('Envie o relatório no campo "file".', 400, 'FILE_REQUIRED');

    const body = uploadSchema.safeParse(request.body);
    if (!body.success) {
      throw new AppError(
        'Informe a origem ("booksy" ou "infinitepay") e, opcionalmente, a comissão padrão entre 0 e 1.',
        400,
        'VALIDATION_ERROR',
      );
    }

    return {
      source: body.data.source,
      defaultCommissionRate: body.data.defaultCommissionRate,
      originalName: file.originalname,
      buffer: file.buffer,
    };
  }
}
