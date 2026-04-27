import { describe, expect, it } from 'vitest';

import { computeAgi } from '@/core/tax/magi';
import { flowToAgi, isRentalNiitEligible, type RentalEInput } from '@/core/tax/rentalE';

describe('simplified Schedule E rental flow', () => {
  it('flows supplied net rental income into AGI exactly', () => {
    const input: RentalEInput = {
      netRentalIncome: 12_345.67,
      cashFlow: 40_000,
    };

    expect(flowToAgi(input)).toBe(12_345.67);
    expect(computeAgi({ wages: 80_000, rentalNetIncome: flowToAgi(input) })).toBe(92_345.67);
  });

  it('preserves negative net rental income for the existing AGI pipeline', () => {
    const input: RentalEInput = {
      netRentalIncome: -4_321.09,
      cashFlow: 10_000,
    };

    expect(flowToAgi(input)).toBe(-4_321.09);
    expect(computeAgi({ wages: 80_000, rentalNetIncome: flowToAgi(input) })).toBe(75_678.91);
  });

  it('keeps cash flow display-only and out of AGI', () => {
    const positiveCashFlow: RentalEInput = {
      netRentalIncome: 0,
      cashFlow: 50_000,
    };
    const negativeCashFlow: RentalEInput = {
      netRentalIncome: 25_000,
      cashFlow: -10_000,
    };

    expect(flowToAgi(positiveCashFlow)).toBe(0);
    expect(flowToAgi(negativeCashFlow)).toBe(25_000);
  });

  it('uses material participation as the simplified NIIT classification switch', () => {
    const input: RentalEInput = {
      netRentalIncome: 18_000,
      cashFlow: 24_000,
    };

    expect(isRentalNiitEligible(input, true)).toBe(false);
    expect(isRentalNiitEligible(input, false)).toBe(true);
    expect(isRentalNiitEligible(input)).toBe(true);
  });
});
