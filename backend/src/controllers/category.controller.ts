// Camada HTTP das categorias: valida a entrada e chama o CategoryService.
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CategoryService } from '../modules/categories/category.service.js';
import { AppError } from '../shared/utils/app-error.js';

const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(['receita', 'despesa', 'ambos']).default('ambos'),
  active: z.boolean().default(true),
});

const idSchema = z.string().regex(/^[a-f\d]{24}$/i);

export class CategoryController {
  constructor(private readonly categoryService = new CategoryService()) {}

  async list(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED');
    // Colaboradores só enxergam categorias ativas (para preencher lançamentos).
    const data = await this.categoryService.list(request.user.role !== 'admin');
    response.json({ status: 'success', data });
  }

  async get(request: Request, response: Response): Promise<void> {
    const data = await this.categoryService.getById(this.parseId(request));
    response.json({ status: 'success', data });
  }

  async create(request: Request, response: Response): Promise<void> {
    const body = categorySchema.safeParse(request.body);
    if (!body.success) throw new AppError('Dados de entrada inválidos.', 400, 'VALIDATION_ERROR');
    const data = await this.categoryService.create(body.data);
    response.status(201).json({ status: 'success', data });
  }

  async update(request: Request, response: Response): Promise<void> {
    const id = this.parseId(request);
    const body = categorySchema.safeParse(request.body);
    if (!body.success) throw new AppError('Dados de entrada inválidos.', 400, 'VALIDATION_ERROR');
    const data = await this.categoryService.update(id, body.data);
    response.json({ status: 'success', data });
  }

  async remove(request: Request, response: Response): Promise<void> {
    await this.categoryService.softDelete(this.parseId(request));
    response.status(204).send();
  }

  private parseId(request: Request): string {
    const id = idSchema.safeParse(request.params['id']);
    if (!id.success) throw new AppError('Identificador inválido.', 400, 'INVALID_ID');
    return id.data;
  }
}
