// Chamadas de /api/reports. Corresponde a backend/src/routes/report.routes.ts.
//
// Os três são restritos ao admin (403 para colaboradora) e exigem start/end como ISO 8601
// completo — por isso o período vem sempre de utils/period.ts, nunca de uma string
// "YYYY-MM-DD" montada à mão.
import { api } from './api';
import { ApiResponse, CashFlowPoint, FinancialSummary } from '../types';
import { periodRange, PeriodKey } from '../utils/period';

export const reportService = {
  /** Resumo financeiro do mês: a mesma conta usada pelo Painel e por Lançamentos. */
  async getFinancialSummary(period: PeriodKey): Promise<FinancialSummary> {
    const response = await api.get<ApiResponse<FinancialSummary>>('/reports/dre', {
      params: periodRange(period),
    });
    return response.data.data;
  },

  /** Fluxo de Caixa (regime de caixa): só lançamentos liquidados, pela data de liquidação. */
  async getCashFlow(period: PeriodKey): Promise<CashFlowPoint[]> {
    const response = await api.get<ApiResponse<CashFlowPoint[]>>('/reports/cash-flow', {
      params: periodRange(period),
    });
    return response.data.data;
  },
};

export interface CashFlowSummary {
  /** Soma dos dias positivos: o que entrou no caixa. */
  inflow: number;
  /** Soma dos dias negativos, em módulo: o que saiu. */
  outflow: number;
  /** Saldo do período (entradas menos saídas). */
  balance: number;
  days: number;
}

/**
 * O backend devolve um saldo líquido por dia (positivo ou negativo), não entradas e
 * saídas separadas. Entrada e saída aqui são, portanto, a soma dos dias positivos e
 * dos negativos — um dia com receita e despesa juntas aparece pelo resultado líquido.
 */
export function summarizeCashFlow(points: readonly CashFlowPoint[]): CashFlowSummary {
  return points.reduce<CashFlowSummary>(
    (summary, point) => ({
      inflow: summary.inflow + Math.max(point.amount, 0),
      outflow: summary.outflow + Math.max(-point.amount, 0),
      balance: summary.balance + point.amount,
      days: summary.days + 1,
    }),
    { inflow: 0, outflow: 0, balance: 0, days: 0 }
  );
}

/** Margem do lucro do estúdio sobre o faturamento bruto, como fração (0.325 = 32,5%). */
export function profitMargin(summary: FinancialSummary): number {
  if (!summary.faturamentoBruto) return 0;
  return summary.lucroEstudio / summary.faturamentoBruto;
}
