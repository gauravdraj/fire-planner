import { describe, expect, it } from 'vitest';

import { allocateRothDistribution, type RothBasisState } from '@/core/rothOrdering';

/*
 * Source-backed model:
 * - IRS Pub. 590-B (2025) says conversion/rollover contributions have a separate
 *   5-year period for the 10% additional tax on early distributions.
 *   https://www.irs.gov/publications/p590b/ar01.html
 * - IRS Form 5329 instructions say early Roth distributions are allocated to
 *   contributions first, then conversions/rollovers FIFO, and within each
 *   conversion first to the taxable portion and then the nontaxable portion.
 *   https://irs.gov/pub/irs-pdf/i5329.pdf
 */

describe('allocateRothDistribution', () => {
  it('draws regular contribution basis first without recapture tax', () => {
    const result = allocateRothDistribution({
      amount: 4_000,
      ownerAge: 45,
      taxYear: 2026,
      state: makeState({
        regularContributionBasis: 10_000,
        conversionLayers: [{ yearConverted: 2026, taxableAmount: 10_000 }],
      }),
    });

    expect(result.regularContributionBasisUsed).toBe(4_000);
    expect(result.conversionTaxableUsed).toBe(0);
    expect(result.recaptureAdditionalTax).toBe(0);
    expect(result.remainingState.regularContributionBasis).toBe(6_000);
  });

  it('applies 10% recapture tax to under-age recent taxable conversion withdrawals', () => {
    const result = allocateRothDistribution({
      amount: 5_000,
      ownerAge: 45,
      taxYear: 2028,
      state: makeState({
        conversionLayers: [{ yearConverted: 2026, taxableAmount: 10_000 }],
      }),
    });

    expect(result.conversionTaxableUsed).toBe(5_000);
    expect(result.recaptureAdditionalTax).toBe(500);
  });

  it('uses conversion year plus four as inside the 5-year recapture window', () => {
    const inside = allocateRothDistribution({
      amount: 1_000,
      ownerAge: 45,
      taxYear: 2030,
      state: makeState({ conversionLayers: [{ yearConverted: 2026, taxableAmount: 1_000 }] }),
    });
    const outside = allocateRothDistribution({
      amount: 1_000,
      ownerAge: 45,
      taxYear: 2031,
      state: makeState({ conversionLayers: [{ yearConverted: 2026, taxableAmount: 1_000 }] }),
    });

    expect(inside.recaptureAdditionalTax).toBe(100);
    expect(outside.recaptureAdditionalTax).toBe(0);
  });

  it('does not apply recapture tax at age 60 or older', () => {
    const result = allocateRothDistribution({
      amount: 5_000,
      ownerAge: 60,
      taxYear: 2028,
      state: makeState({ conversionLayers: [{ yearConverted: 2026, taxableAmount: 10_000 }] }),
    });

    expect(result.recaptureAdditionalTax).toBe(0);
  });

  it('treats age 59 as still inside the conservative under-59.5 boundary', () => {
    const result = allocateRothDistribution({
      amount: 1_000,
      ownerAge: 59,
      taxYear: 2026,
      state: makeState({ conversionLayers: [{ yearConverted: 2026, taxableAmount: 1_000 }] }),
    });

    expect(result.recaptureAdditionalTax).toBe(100);
  });

  it('allocates conversion layers FIFO and taxable before nontaxable inside a layer', () => {
    const result = allocateRothDistribution({
      amount: 9_000,
      ownerAge: 45,
      taxYear: 2026,
      state: makeState({
        conversionLayers: [
          { yearConverted: 2024, taxableAmount: 3_000, nontaxableAmount: 2_000 },
          { yearConverted: 2025, taxableAmount: 10_000 },
        ],
      }),
    });

    expect(result.conversionTaxableUsed).toBe(7_000);
    expect(result.conversionNontaxableUsed).toBe(2_000);
    expect(result.remainingState.conversionLayers).toEqual([{ yearConverted: 2025, taxableAmount: 6_000 }]);
  });

  it('signals earnings when withdrawals exceed tracked basis and conversion layers', () => {
    const result = allocateRothDistribution({
      amount: 12_000,
      ownerAge: 45,
      taxYear: 2026,
      state: makeState({
        regularContributionBasis: 5_000,
        conversionLayers: [{ yearConverted: 2020, taxableAmount: 4_000 }],
      }),
    });

    expect(result.earningsTapped).toBe(true);
    expect(result.earningsUsed).toBe(3_000);
  });
});

function makeState(overrides: Partial<RothBasisState>): RothBasisState {
  return {
    regularContributionBasis: 0,
    conversionLayers: [],
    ...overrides,
  };
}
