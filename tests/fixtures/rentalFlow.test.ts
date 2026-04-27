import { describe, expect, it } from 'vitest';

import { computeAgi } from '@/core/tax/magi';
import { flowToAgi, isRentalNiitEligible, type RentalEInput } from '@/core/tax/rentalE';

/*
 * Fixture notes:
 * Gate 2 intentionally treats Schedule E as a user-supplied net rental income
 * amount. This test suite does not calculate depreciation, passive-loss limits,
 * at-risk limitations, or material-participation hours; it only proves the
 * simplified amount flows into the existing AGI/MAGI pipeline.
 *
 * Sources:
 * - IRS Instructions for Schedule E (Form 1040) (2025), rental real estate
 *   income and expense reporting, retrieved 2026-04-26,
 *   https://www.irs.gov/instructions/i1040se
 * - IRS Publication 527 (2025), Residential Rental Property, rental income and
 *   expenses, retrieved 2026-04-26, https://www.irs.gov/publications/p527
 * - IRS Publication 925 (2025), Passive Activity and At-Risk Rules, material
 *   participation and passive rental activity rules, retrieved 2026-04-26,
 *   https://www.irs.gov/publications/p925
 */
describe('rental flow fixture', () => {
  it('flows supplied net rental income into AGI exactly', () => {
    const input: RentalEInput = {
      netRentalIncome: 14_250.75,
      cashFlow: 18_000,
    };

    expect(flowToAgi(input)).toBe(14_250.75);
  });

  it('composes W-2 wages plus rental net income through computeAgi', () => {
    const rental: RentalEInput = {
      netRentalIncome: 12_345.67,
      cashFlow: 15_000,
    };

    expect(computeAgi({ wages: 80_000, rentalNetIncome: flowToAgi(rental) })).toBe(92_345.67);
  });

  it('treats material participation as disabling rental NIIT eligibility', () => {
    const rental: RentalEInput = {
      netRentalIncome: 9_600,
    };

    expect(isRentalNiitEligible(rental, true)).toBe(false);
  });

  it('defaults rental income to NIIT eligible when material participation is not supplied', () => {
    const rental: RentalEInput = {
      netRentalIncome: 9_600,
    };

    expect(isRentalNiitEligible(rental)).toBe(true);
  });
});
