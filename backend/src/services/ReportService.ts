import { Transaction } from '../models/Transaction.js';
import { AppError } from '../utils/AppError.js';

export interface DateRange {
  start: Date;
  end: Date;
}

export class ReportService {
  async getDre(range: DateRange): Promise<Record<string, number>> {
    const entries = await Transaction.find({
      deletedAt: null,
      occurredAt: { $gte: range.start, $lte: range.end },
      status: { $ne: 'cancelada' },
    }).lean();

    const totals = {
      receitaBruta: 0,
      descontos: 0,
      taxas: 0,
      receitaLiquida: 0,
      custosVariaveis: 0,
      despesasFixas: 0,
      resultado: 0,
    };

    for (const entry of entries) {
      if (entry.type === 'receita') {
        totals.receitaBruta += entry.grossAmount;
        totals.descontos += entry.discountAmount;
        totals.taxas += entry.feeAmount;
        totals.receitaLiquida += entry.grossAmount - entry.discountAmount - entry.feeAmount;
        totals.custosVariaveis += entry.commissionAmount;
        totals.resultado += entry.studioNetProfit;
      } else if (entry.costType === 'fixo') {
        totals.despesasFixas += entry.grossAmount;
        totals.resultado -= entry.grossAmount;
      } else {
        totals.custosVariaveis += entry.grossAmount;
        totals.resultado -= entry.grossAmount;
      }
    }

    return totals;
  }

  async getCashFlow(range: DateRange): Promise<{ date: string; amount: number }[]> {
    const entries = await Transaction.find({
      deletedAt: null,
      settledAt: { $gte: range.start, $lte: range.end },
      status: 'liquidada',
    }).sort({ settledAt: 1 }).lean();
    const daily = new Map<string, number>();

    for (const entry of entries) {
      if (!entry.settledAt) continue;
      const date = entry.settledAt.toISOString().slice(0, 10);
      const sign = entry.type === 'receita' ? 1 : -1;
      daily.set(date, (daily.get(date) ?? 0) + sign * entry.netAmount);
    }

    return [...daily.entries()].map(([date, amount]) => ({
      date,
      amount: Math.round((amount + Number.EPSILON) * 100) / 100,
    }));
  }

  validateRange(start: string, end: string): DateRange {
    const range = { start: new Date(start), end: new Date(end) };
    if (Number.isNaN(range.start.getTime()) || Number.isNaN(range.end.getTime()) || range.start > range.end) {
      throw new AppError('Período inválido.', 400, 'INVALID_DATE_RANGE');
    }
    return range;
  }
}