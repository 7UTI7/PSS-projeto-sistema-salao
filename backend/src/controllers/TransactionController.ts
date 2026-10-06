import type { Request, Response } from 'express';
import { z } from 'zod';
import { TransactionService } from '../services/TransactionService.js';
import { AppError } from '../utils/AppError.js';

const transactionSchema = z.object({
  type: z.enum(['receita', 'despesa']),
  description: z.string().trim().min(1).max(240),
  grossAmount: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
  paymentFeeRate: z.number().min(0).max(1).default(0),
  professionalCommissionRate: z.number().min(0).max(1).default(0),
  professional: z.enum(['Nicolle', 'Stefany']).optional(),
  category: z.string().trim().min(1).max(100),
  costType: z.enum(['fixo', 'variavel']).optional(),
  paymentMethod: z.enum(['pix', 'credito', 'debito', 'dinheiro']),
  occurredAt: z.coerce.date(),
  settledAt: z.coerce.date().optional(),
  status: z.enum(['pendente', 'liquidada', 'cancelada']).default('pendente'),
  origin: z.enum(['manual', 'booksy', 'infinitepay']).default('manual'),
}).superRefine((value, context) => {
  if (value.type === 'despesa' && !value.costType) {
    context.addIssue({ code: 'custom', path: ['costType'], message: 'Informe se o custo é fixo ou variável.' });
  }
});

export class TransactionController {
  constructor(private readonly transactionService = new TransactionService()) {}

  async list(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED');
    const data = await this.transactionService.list(request.user);
    response.json({ status: 'success', data });
  }

  async create(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED');
    const result = transactionSchema.safeParse(request.body);
    if (!result.success) throw new AppError('Dados de entrada inválidos.', 400, 'VALIDATION_ERROR');
    const data = await this.transactionService.create(result.data, request.user);
    response.status(201).json({ status: 'success', data });
  }

  async remove(request: Request, response: Response): Promise<void> {
    if (!request.user) throw new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED');
    const id = z.string().regex(/^[a-f\d]{24}$/i).safeParse(request.params['id']);
    if (!id.success) throw new AppError('Identificador inválido.', 400, 'INVALID_ID');
    await this.transactionService.softDelete(id.data, request.user);
    response.status(204).send();
  }
}