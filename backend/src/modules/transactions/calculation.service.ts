// Cálculo financeiro de uma receita em 5 passos, com arredondamento em centavos.
import type { PaymentMethod } from '../../models/transaction.model.js';

/**
 * Taxa por forma de pagamento aplicada quando o lançamento não informa a sua.
 *
 * Mora no servidor de propósito. A ordem de precedência é: taxa real do arquivo, quando a
 * origem informa (é o caso da coluna "Taxa" do Booksy); senão esta tabela; e nada fica
 * fixo no aplicativo. O extrato da InfinitePay não traz taxa em coluna nenhuma — o
 * repasse da maquininha já chega líquido —, então as linhas dele ficam com zero e a taxa
 * do cartão aparece deduzida na conciliação.
 */
export const DEFAULT_PAYMENT_FEE_RATES: Record<PaymentMethod, number> = {
  pix: 0,
  dinheiro: 0,
  debito: 0.0139,
  credito: 0.0399,
  nao_informado: 0,
};

export interface CalculationInput {
  grossAmount: number;
  discountAmount: number;
  paymentFeeRate: number;
  professionalCommissionRate: number;
}

export interface CalculationResult {
  baseAmount: number;
  feeAmount: number;
  commissionAmount: number;
  netAmount: number;
  studioNetProfit: number;
}

function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export class CalculationService {
  calculate(input: CalculationInput): CalculationResult {
    const values = [
      input.grossAmount,
      input.discountAmount,
      input.paymentFeeRate,
      input.professionalCommissionRate,
    ];

    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new RangeError('Os valores e alíquotas devem ser números finitos não negativos.');
    }

    if (input.discountAmount > input.grossAmount) {
      throw new RangeError('O desconto não pode superar o valor bruto.');
    }

    if (input.paymentFeeRate > 1 || input.professionalCommissionRate > 1) {
      throw new RangeError('As alíquotas devem estar entre 0 e 1.');
    }

    const baseAmount = roundCurrency(input.grossAmount - input.discountAmount);
    const feeAmount = roundCurrency(baseAmount * input.paymentFeeRate);
    const commissionAmount = roundCurrency(baseAmount * input.professionalCommissionRate);
    const netAmount = roundCurrency(baseAmount - feeAmount);
    const studioNetProfit = roundCurrency(netAmount - commissionAmount);

    return { baseAmount, feeAmount, commissionAmount, netAmount, studioNetProfit };
  }
}