import { describe, expect, it } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import type { BracketTable } from '@/core/types';
import { computeFederalTax, computeTaxableIncome } from '@/core/tax/federal';

const simpleStatusBrackets = [
  { from: 0, rate: 0.1 },
  { from: 10_000, rate: 0.2 },
  { from: 20_000, rate: 0.3 },
] as const;

const simpleBrackets: BracketTable = {
  single: simpleStatusBrackets,
  mfj: simpleStatusBrackets,
  hoh: simpleStatusBrackets,
  mfs: simpleStatusBrackets,
};

describe('computeFederalTax', () => {
  it('walks brackets cumulatively using actual taxable income', () => {
    expect(computeFederalTax(0, 'single', simpleBrackets)).toBe(0);
    expect(computeFederalTax(10_000, 'single', simpleBrackets)).toBe(1_000);
    expect(computeFederalTax(25_000, 'single', simpleBrackets)).toBe(4_500);
  });

  it('handles income exactly at bracket boundaries', () => {
    expect(computeFederalTax(20_000, 'single', simpleBrackets)).toBe(3_000);
    expect(computeFederalTax(50_400, 'single', CONSTANTS_2026.federal.ordinaryBrackets)).toBe(5_800);
  });

  it('rounds ordinary tax to cents at the return boundary', () => {
    expect(computeFederalTax(10.05, 'single', simpleBrackets)).toBe(1.01);
  });
});

describe('computeTaxableIncome', () => {
  it('applies standard deductions and floors taxable income at zero', () => {
    expect(computeTaxableIncome(16_099.99, 'single')).toBe(0);
    expect(computeTaxableIncome(50_000, 'hoh')).toBe(25_850);
  });

  it('applies the senior deduction only for eligible filing statuses and people', () => {
    expect(computeTaxableIncome(50_000, 'single', { age65Plus: true })).toBe(27_900);
    expect(computeTaxableIncome(100_000, 'mfs', { age65Plus: true, partnerAge65Plus: true })).toBe(83_900);
  });

  it('uses AGI as senior-deduction MAGI unless an explicit MAGI is supplied', () => {
    expect(computeTaxableIncome(100_000, 'single', { age65Plus: true })).toBe(79_400);
    expect(computeTaxableIncome(100_000, 'single', { age65Plus: true, magi: 80_000 })).toBe(78_200);
  });

  it('applies the senior deduction phaseout per eligible person on joint returns', () => {
    expect(
      computeTaxableIncome(250_000, 'mfj', {
        age65Plus: true,
        partnerAge65Plus: true,
        magi: 200_000,
      }),
    ).toBe(211_800);
  });
});
