import { describe, expect, it } from 'vitest';

import { toReal } from '@/lib/realDollars';

describe('real-dollar display helper', () => {
  it('keeps base-year amounts unchanged', () => {
    expect(toReal(100_000, 2026, 2026, 0.03)).toBe(100_000);
  });

  it('discounts future nominal dollars to the base year', () => {
    expect(toReal(103_000, 2027, 2026, 0.03)).toBeCloseTo(100_000, 10);
  });

  it('keeps zero amounts at zero', () => {
    expect(toReal(0, 2035, 2026, 0.03)).toBe(0);
  });

  it('uses nonzero inflation over multiple years', () => {
    expect(toReal(121_000, 2028, 2026, 0.1)).toBeCloseTo(100_000, 10);
  });
});
