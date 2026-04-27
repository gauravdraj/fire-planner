import { describe, expect, it } from 'vitest';

import { compute72tIraSize } from '@/core/seventyTwoT';

describe('compute72tIraSize', () => {
  it('matches the spreadsheet default fixed amortization input', () => {
    expect(compute72tIraSize(0.05, 33.4, 50_000)).toBeCloseTo(803_990.37, 2);
  });

  it('handles a zero rate as payment times years', () => {
    expect(compute72tIraSize(0, 33.4, 50_000)).toBe(1_670_000);
  });

  it('computes a constructed amortization case', () => {
    // Spreadsheet-compatible derivation: PV = payment * (1 - (1 + rate)^-n) / rate.
    const expected = roundToCents((60_000 * (1 - Math.pow(1.07, -25))) / 0.07);

    expect(compute72tIraSize(0.07, 25, 60_000)).toBeCloseTo(expected, 2);
  });

  it('returns zero when desired annual income is zero', () => {
    expect(compute72tIraSize(0.05, 33.4, 0)).toBe(0);
  });

  it('keeps low non-zero rates on the present-value formula path', () => {
    const expected = roundToCents((12_000 * (1 - Math.pow(1.0001, -10))) / 0.0001);

    expect(compute72tIraSize(0.0001, 10, 12_000)).toBeCloseTo(expected, 2);
  });
});

function roundToCents(value: number): number {
  return Math.trunc(value * 100 + 0.5 + Number.EPSILON) / 100;
}
