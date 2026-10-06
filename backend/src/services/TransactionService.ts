import { Transaction, type Professional, type TransactionFields } from '../models/Transaction.js';
import type { AuthenticatedUser } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { CalculationService } from './CalculationService.js';

const calculationService = new CalculationService();

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

    const calculation = input.type === 'receita'
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
      ...(input.settledAt ? { settledAt: input.settledAt } : {}),
      status: input.status,
      origin: input.origin,
      createdBy: actor.id,
    });
    return transaction.toObject();
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