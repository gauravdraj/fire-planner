import { describe, expect, it } from 'vitest';

import { computeSeTax } from '@/core/tax/seTax';

describe('computeSeTax', () => {
  it('returns zero components for zero or negative net SE income', () => {
    const expectedZeroResult = {
      adjustedSeIncome: 0,
      socialSecurityTaxableIncome: 0,
      socialSecurityTax: 0,
      medicareTax: 0,
      additionalMedicareTax: 0,
      totalSeTax: 0,
      deductibleHalf: 0,
    };

    expect(
      computeSeTax({
        netSeIncome: 0,
        w2WagesSubjectToSs: 200_000,
        totalMedicareWages: 300_000,
        filingStatus: 'single',
      }),
    ).toEqual(expectedZeroResult);
    expect(
      computeSeTax({
        netSeIncome: -10_000,
        w2WagesSubjectToSs: 0,
        totalMedicareWages: 0,
        filingStatus: 'mfj',
      }),
    ).toEqual(expectedZeroResult);
  });

  it('applies the 92.35% adjustment before Social Security and Medicare SE tax', () => {
    expect(
      computeSeTax({
        netSeIncome: 100_000,
        w2WagesSubjectToSs: 0,
        totalMedicareWages: 0,
        filingStatus: 'single',
      }),
    ).toEqual({
      adjustedSeIncome: 92_350,
      socialSecurityTaxableIncome: 92_350,
      socialSecurityTax: 11_451.4,
      medicareTax: 2_678.15,
      additionalMedicareTax: 0,
      totalSeTax: 14_129.55,
      deductibleHalf: 7_064.78,
    });
  });

  it('caps Social Security SE tax after W-2 Social Security wages absorb the wage base', () => {
    expect(
      computeSeTax({
        netSeIncome: 100_000,
        w2WagesSubjectToSs: 150_000,
        totalMedicareWages: 150_000,
        filingStatus: 'single',
      }),
    ).toEqual({
      adjustedSeIncome: 92_350,
      socialSecurityTaxableIncome: 34_500,
      socialSecurityTax: 4_278,
      medicareTax: 2_678.15,
      additionalMedicareTax: 381.15,
      totalSeTax: 7_337.3,
      deductibleHalf: 3_478.08,
    });
  });

  it('does not tax W-2 Social Security wages again when they exceed the wage base', () => {
    expect(
      computeSeTax({
        netSeIncome: 10_000,
        w2WagesSubjectToSs: 200_000,
        totalMedicareWages: 300_000,
        filingStatus: 'mfj',
      }),
    ).toEqual({
      adjustedSeIncome: 9_235,
      socialSecurityTaxableIncome: 0,
      socialSecurityTax: 0,
      medicareTax: 267.82,
      additionalMedicareTax: 83.12,
      totalSeTax: 350.93,
      deductibleHalf: 133.91,
    });
  });

  it('applies Additional Medicare Tax only to adjusted SE income over the combined-income threshold', () => {
    expect(
      computeSeTax({
        netSeIncome: 20_000,
        w2WagesSubjectToSs: 0,
        totalMedicareWages: 190_000,
        filingStatus: 'single',
      }),
    ).toEqual({
      adjustedSeIncome: 18_470,
      socialSecurityTaxableIncome: 18_470,
      socialSecurityTax: 2_290.28,
      medicareTax: 535.63,
      additionalMedicareTax: 76.23,
      totalSeTax: 2_902.14,
      deductibleHalf: 1_412.96,
    });
  });

  it('rounds returned monetary fields to cents without repeatedly rounding intermediate tax components', () => {
    expect(
      computeSeTax({
        netSeIncome: 10,
        w2WagesSubjectToSs: 0,
        totalMedicareWages: 0,
        filingStatus: 'single',
      }),
    ).toEqual({
      adjustedSeIncome: 9.24,
      socialSecurityTaxableIncome: 9.24,
      socialSecurityTax: 1.15,
      medicareTax: 0.27,
      additionalMedicareTax: 0,
      totalSeTax: 1.41,
      deductibleHalf: 0.71,
    });
  });
});
