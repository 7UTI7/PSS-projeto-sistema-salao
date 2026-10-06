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