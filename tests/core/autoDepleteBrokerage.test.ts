import { describe, expect, it } from 'vitest';

import { computeAutoDepleteSchedule } from '@/core/autoDepleteBrokerage';

describe('computeAutoDepleteSchedule', () => {
  it('returns one withdrawal per depletion year and preserves the growing-annuity present value', () => {
    const schedule = computeAutoDepleteSchedule(400_000, 10, 0.02, 0.05);

    expect(schedule).toHaveLength(10);
    expect(schedule[0]).toBeGreaterThan(0);

    for (let index = 1; index < schedule.length; index += 1) {
      expect(schedule[index]! / schedule[index - 1]!).toBeCloseTo(1.02, 10);
    }

    const presentValue = schedule.reduce((sum, withdrawal, index) => sum + withdrawal / 1.05 ** index, 0);

    expect(presentValue).toBeCloseTo(400_000, 6);
  });

  it('returns zeros for zero balances without throwing', () => {
    expect(computeAutoDepleteSchedule(0, 4, 0.02, 0.05)).toEqual([0, 0, 0, 0]);
  });

  it('uses straight-line withdrawals when expected return equals the scale-up factor', () => {
    const schedule = computeAutoDepleteSchedule(120_000, 3, 0.05, 0.05);

    expect(schedule[0]).toBe(40_000);
    expect(schedule[1]).toBe(42_000);
    expect(schedule[2]).toBe(44_100);
  });
});
