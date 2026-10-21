// Regras de negócio dos lançamentos: listar, criar, editar, liquidar e excluir.
import { Transaction, type Professional, type TransactionFields } from './transaction.model.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../../shared/utils/app-error.js';
import { CalculationService } from './calculation.service.js';
import { CategoryService } from '../categories/category.service.js';

const calculationService = new CalculationService();
const categoryService = new CategoryService();

export interface CreateTransactionInput {
  type: 'receita' | 'despesa';
  description: string;
  grossAmount: number;
  discountAmount: number;
  paymentFeeRate: number;
  professionalCommissionRate: number;
  professional?: Professional | undefined;
  category: string;
  costType?: 'fixo' | 'variavel' | undefined;
  paymentMethod: 'pix' | 'credito' | 'debito' | 'dinheiro';
  occurredAt: Date;
  settledAt?: Date | undefined;
  status: 'pendente' | 'liquidada' | 'cancelada';
  origin: 'manual' | 'booksy' | 'infinitepay';
}

export class TransactionService {
  async list(actor: AuthenticatedUser): Promise<unknown[]> {
    const filter = actor.role === 'admin'
      ? { deletedAt: null }
      : { deletedAt: null, professional: this.professionalFor(actor) };
    const query = Transaction.find(filter).sort({ occurredAt: -1 }).limit(500);
    if (actor.role === 'colaborador') {
      query.select('type description grossAmount commissionAmount category occurredAt status');
    }
    return query.lean();
  }

  async create(input: CreateTransactionInput, actor: AuthenticatedUser): Promise<TransactionFields> {
    if (actor.role === 'colaborador' && input.type !== 'receita') {
      throw new AppError('Colaboradores podem registrar apenas receitas próprias.', 403, 'FORBIDDEN');
    }

    const professional = actor.role === 'admin'
      ? (input.professional ?? 'Nicolle')
      : this.professionalFor(actor);

    await categoryService.assertActive(input.category, input.type);
    const calculation = this.calculate(input);
    const settledAt = this.resolveSettledAt(input.status, input.settledAt);

    const transaction = await Transaction.create({
      type: input.type,
      description: input.description,
      grossAmount: input.grossAmount,
      discountAmount: input.discountAmount,
      feeAmount: calculation.feeAmount,
      professional,
      commissionAmount: calculation.commissionAmount,
      studioNetProfit: calculation.studioNetProfit,
      netAmount: calculation.netAmount,
      category: input.category,
      ...(input.costType ? { costType: input.costType } : {}),
      paymentMethod: input.paymentMethod,
      occurredAt: input.occurredAt,
      ...(settledAt ? { settledAt } : {}),
      status: input.status,
      origin: input.origin,
      createdBy: actor.id,
    });
    return transaction.toObject();
  }

  async update(transactionId: string, input: CreateTransactionInput, actor: AuthenticatedUser): Promise<TransactionFields> {
    if (actor.role === 'colaborador' && input.type !== 'receita') {
      throw new AppError('Colaboradores podem registrar apenas receitas próprias.', 403, 'FORBIDDEN');
    }
    const filter = actor.role === 'admin'
      ? { _id: transactionId, deletedAt: null }
      : { _id: transactionId, professional: this.professionalFor(actor), deletedAt: null };
    const existing = await Transaction.findOne(filter);
    if (!existing) throw new AppError('Lançamento não encontrado.', 404, 'NOT_FOUND');

    await categoryService.assertActive(input.category, input.type);
    const calculation = this.calculate(input);
    const settledAt = this.resolveSettledAt(input.status, input.settledAt ?? existing.settledAt);

    existing.type = input.type;
    existing.description = input.description;
    existing.grossAmount = input.grossAmount;
    existing.discountAmount = input.discountAmount;
    existing.feeAmount = calculation.feeAmount;
    existing.commissionAmount = calculation.commissionAmount;
    existing.studioNetProfit = calculation.studioNetProfit;
    existing.netAmount = calculation.netAmount;
    existing.category = input.category;
    existing.paymentMethod = input.paymentMethod;
    existing.occurredAt = input.occurredAt;
    existing.status = input.status;
    existing.origin = input.origin;
    if (actor.role === 'admin' && input.professional) existing.professional = input.professional;
    if (input.costType) existing.costType = input.costType; else existing.set('costType', undefined);
    if (settledAt) existing.settledAt = settledAt; else existing.set('settledAt', undefined);
    await existing.save();
    return existing.toObject();
  }

  /**
   * Liquidada exige settledAt (alimenta o Fluxo de Caixa): usa a data informada ou agora.
   * Pendente/cancelada nunca mantém settledAt.
   */
  private resolveSettledAt(status: CreateTransactionInput['status'], settledAt?: Date | undefined): Date | undefined {
    if (status !== 'liquidada') return undefined;
    return settledAt ?? new Date();
  }

  private calculate(input: CreateTransactionInput) {
    return input.type === 'receita'
      ? calculationService.calculate({
          grossAmount: input.grossAmount,
          discountAmount: input.discountAmount,
          paymentFeeRate: input.paymentFeeRate,
          professionalCommissionRate: input.professionalCommissionRate,
        })
      : {
          baseAmount: input.grossAmount,
          feeAmount: 0,
          commissionAmount: 0,
          netAmount: input.grossAmount,
          studioNetProfit: -input.grossAmount,
        };
  }

  async softDelete(transactionId: string, actor: AuthenticatedUser): Promise<void> {
    const filter = actor.role === 'admin'
      ? { _id: transactionId, deletedAt: null }
      : { _id: transactionId, professional: this.professionalFor(actor), deletedAt: null };
    const result = await Transaction.updateOne(filter, { $set: { deletedAt: new Date() } });
    if (result.matchedCount === 0) throw new AppError('Lançamento não encontrado.', 404, 'NOT_FOUND');
  }

  private professionalFor(actor: AuthenticatedUser): Professional {
    if (actor.role === 'admin') return 'Nicolle';
    if (actor.role === 'colaborador') return 'Stefany';
    throw new AppError('Perfil sem profissional associado.', 403, 'PROFESSIONAL_NOT_MAPPED');
  }
}