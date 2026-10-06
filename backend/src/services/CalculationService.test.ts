import { describe, expect, it } from 'vitest';
import { CalculationService } from './CalculationService.js';

describe('CalculationService', () => {
  const service = new CalculationService();

  it('applies the specified order and rounds each monetary result to cents', () => {
    expect(
      service.calculate({
        grossAmount: 100,
        discountAmount: 10,
        paymentFeeRate: 0.05,
        professionalCommissionRate: 0.2,
      }),
    ).toEqual({
      baseAmount: 90,
      feeAmount: 4.5,
      commissionAmount: 18,
      netAmount: 85.5,
      studioNetProfit: 67.5,
    });
  });

  it('rejects discounts above the gross amount', () => {
    expect(() =>
      service.calculate({
        grossAmount: 10,
        discountAmount: 11,
        paymentFeeRate: 0,
        professionalCommissionRate: 0,
      }),
    ).toThrow(RangeError);
  });
});