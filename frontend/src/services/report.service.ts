import { api } from './api';
import { ApiResponse, DREReport, CashFlowReport } from '../types';

export const reportService = {
  /**
   * Obtém o relatório DRE Simplificado (restrito ao perfil admin)
   * @param start Data inicial no formato ISO (YYYY-MM-DD)
   * @param end Data final no formato ISO (YYYY-MM-DD)
   */
  async getDRE(start: string, end: string): Promise<DREReport> {
    const response = await api.get<ApiResponse<DREReport>>('/reports/dre', {
      params: { start, end },
    });
    return response.data.data;
  },

  /**
   * Obtém o relatório de Fluxo de Caixa (restrito ao perfil admin)
   * @param start Data inicial no formato ISO (YYYY-MM-DD)
   * @param end Data final no formato ISO (YYYY-MM-DD)
   */
  async getCashFlow(start: string, end: string): Promise<CashFlowReport> {
    const response = await api.get<ApiResponse<CashFlowReport>>('/reports/cash-flow', {
      params: { start, end },
    });
    return response.data.data;
  },
};
