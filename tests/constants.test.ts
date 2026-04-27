import { describe, expect, it } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import constantsSource from '../src/core/constants/2026.ts?raw';

const filingStatuses = ['single', 'mfj', 'hoh', 'mfs'] as const;
const sourcedSections = ['federal', 'ltcg', 'niit', 'seTax', 'qbi', 'fpl', 'fpl2025', 'aca', 'irmaa'] as const;
const fplRegions = ['contiguous', 'alaska', 'hawaii'] as const;
const householdSizes = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function expectDeepFrozen(value: unknown): void {
  if (!isObject(value)) {
    return;
  }

  expect(Object.isFrozen(value)).toBe(true);

  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen(value[key]);
  }
}

function expectPositiveValues(values: readonly number[]): void {
  for (const value of values) {
    expect(value).toBeGreaterThan(0);
  }
}

describe('CONSTANTS_2026', () => {
  it('is a sourced, recursively frozen 2026 constants object', () => {
    expect(CONSTANTS_2026.taxYear).toBe(2026);
    expect(CONSTANTS_2026.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(Object.isFrozen(CONSTANTS_2026)).toBe(true);
    expect(Object.isFrozen(CONSTANTS_2026.federal.standardDeduction)).toBe(true);
    expect(Object.isFrozen(CONSTANTS_2026.federal.ordinaryBrackets.single)).toBe(true);
    expect(Object.isFrozen(CONSTANTS_2026.ltcg.brackets.single)).toBe(true);
    expect(Object.isFrozen(CONSTANTS_2026.fpl.contiguous)).toBe(true);
    expect(Object.isFrozen(CONSTANTS_2026.fpl2025.contiguous)).toBe(true);
    expect(Object.isFrozen(CONSTANTS_2026.aca.applicablePercentages)).toBe(true);
    expect(Object.isFrozen(CONSTANTS_2026.irmaa.partBTiers.single)).toBe(true);
    expectDeepFrozen(CONSTANTS_2026);

    for (const section of sourcedSections) {
      expect(CONSTANTS_2026[section].source).toEqual(expect.stringMatching(/\S/));
      expect(CONSTANTS_2026[section].retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(CONSTANTS_2026[section].retrievedAt).toBe(CONSTANTS_2026.retrievedAt);
    }
  });

  it('contains no unresolved TBD-VERIFY markers in the sealed constants source', () => {
    expect(constantsSource).not.toMatch(/TBD-VERIFY/);
  });

  it('pins federal standard deductions and ordinary brackets', () => {
    expect(CONSTANTS_2026.federal.standardDeduction).toEqual({
      single: 16_100,
      mfj: 32_200,
      hoh: 24_150,
      mfs: 16_100,
    });

    for (const status of filingStatuses) {
      expect(CONSTANTS_2026.federal.ordinaryBrackets[status]).not.toHaveLength(0);
      expect(CONSTANTS_2026.federal.ordinaryBrackets[status][0]).toEqual({ from: 0, rate: 0.1 });
    }

    expect(CONSTANTS_2026.federal.ordinaryBrackets.single.at(-1)).toEqual({ from: 640_600, rate: 0.37 });
    expect(CONSTANTS_2026.federal.ordinaryBrackets.mfj.at(-1)).toEqual({ from: 768_700, rate: 0.37 });
    expect(CONSTANTS_2026.federal.ordinaryBrackets.mfs.at(-1)).toEqual({ from: 384_350, rate: 0.37 });
  });

  it('pins LTCG brackets for every filing status', () => {
    for (const status of filingStatuses) {
      expect(CONSTANTS_2026.ltcg.brackets[status]).not.toHaveLength(0);
      expect(CONSTANTS_2026.ltcg.brackets[status].map((bracket) => bracket.rate)).toEqual([0, 0.15, 0.2]);
    }

    expect(CONSTANTS_2026.ltcg.brackets.single).toEqual([
      { from: 0, rate: 0 },
      { from: 49_450, rate: 0.15 },
      { from: 545_500, rate: 0.2 },
    ]);
    expect(CONSTANTS_2026.ltcg.brackets.mfj).toEqual([
      { from: 0, rate: 0 },
      { from: 98_900, rate: 0.15 },
      { from: 613_700, rate: 0.2 },
    ]);
  });

  it('pins NIIT, self-employment tax, and QBI constants', () => {
    expect(CONSTANTS_2026.niit.rate).toBe(0.038);
    expect(CONSTANTS_2026.niit.magiThresholds).toEqual({
      single: 200_000,
      mfj: 250_000,
      hoh: 200_000,
      mfs: 125_000,
    });

    expect(CONSTANTS_2026.seTax.ssWageBase).toBe(184_500);
    expect(CONSTANTS_2026.seTax.selfEmploymentRate).toBe(0.153);

    expect(CONSTANTS_2026.qbi.phaseouts.single).toEqual({ start: 201_750, end: 276_750 });
    expect(CONSTANTS_2026.qbi.phaseouts.mfj).toEqual({ start: 403_500, end: 553_500 });
    for (const status of filingStatuses) {
      expect(CONSTANTS_2026.qbi.phaseouts[status].start).toBeGreaterThan(0);
      expect(CONSTANTS_2026.qbi.phaseouts[status].end).toBeGreaterThan(CONSTANTS_2026.qbi.phaseouts[status].start);
    }
  });

  it('contains non-placeholder 2026 and 2025 FPL tables for ACA lag handling', () => {
    expect(CONSTANTS_2026.fpl.year).toBe(2026);
    expect(CONSTANTS_2026.fpl2025.year).toBe(2025);
    expect(CONSTANTS_2026.aca.premiumTaxCreditFplYear).toBe(CONSTANTS_2026.fpl2025.year);

    for (const table of [CONSTANTS_2026.fpl, CONSTANTS_2026.fpl2025]) {
      for (const region of fplRegions) {
        for (const size of householdSizes) {
          expect(table[region].householdSize[size]).toBeGreaterThan(0);
        }
        expect(table[region].additionalPerPerson).toBeGreaterThan(0);
      }
    }

    expect(CONSTANTS_2026.fpl.contiguous.householdSize[1]).toBe(15_960);
    expect(CONSTANTS_2026.fpl2025.hawaii.additionalPerPerson).toBe(6_330);
  });

  it('pins ACA applicable percentages and IRMAA lookback structure', () => {
    expect(CONSTANTS_2026.aca.applicablePercentages).not.toHaveLength(0);
    expect(CONSTANTS_2026.aca.applicablePercentages[0]).toEqual({
      fplFrom: 0,
      fplTo: 1.33,
      initial: 0.021,
      final: 0.021,
    });
    expect(CONSTANTS_2026.aca.requiredContributionPercentage).toBe(0.0996);

    expect(CONSTANTS_2026.irmaa.lookbackYears).toBe(2);
    expect(CONSTANTS_2026.irmaa.incomeYear).toBe(2024);
    expect(CONSTANTS_2026.irmaa.partBTiers.single[1]?.magiOver).toBe(109_000);
    expect(CONSTANTS_2026.irmaa.partBTiers.mfj[1]?.magiOver).toBe(218_000);
    expect(CONSTANTS_2026.irmaa.partBTiers.mfs).toHaveLength(3);
  });

  it('does not contain placeholder zero values in required numeric constant tables', () => {
    expectPositiveValues(Object.values(CONSTANTS_2026.federal.standardDeduction));
    expectPositiveValues(Object.values(CONSTANTS_2026.niit.magiThresholds));
    expectPositiveValues(Object.values(CONSTANTS_2026.seTax.additionalMedicareThresholds));
    expectPositiveValues([
      CONSTANTS_2026.niit.rate,
      CONSTANTS_2026.seTax.ssWageBase,
      CONSTANTS_2026.seTax.selfEmploymentRate,
      CONSTANTS_2026.seTax.oasdiRate,
      CONSTANTS_2026.seTax.medicareRate,
      CONSTANTS_2026.seTax.additionalMedicareRate,
      CONSTANTS_2026.irmaa.standardPartBPremium,
    ]);

    for (const status of filingStatuses) {
      const ordinaryBrackets = CONSTANTS_2026.federal.ordinaryBrackets[status];
      expect(ordinaryBrackets[0]?.from).toBe(0);
      for (const bracket of ordinaryBrackets) {
        expect(bracket.rate).toBeGreaterThan(0);
      }
      for (const bracket of ordinaryBrackets.slice(1)) {
        expect(bracket.from).toBeGreaterThan(0);
      }

      const ltcgBrackets = CONSTANTS_2026.ltcg.brackets[status];
      expect(ltcgBrackets[0]).toEqual({ from: 0, rate: 0 });
      for (const bracket of ltcgBrackets.slice(1)) {
        expect(bracket.from).toBeGreaterThan(0);
        expect(bracket.rate).toBeGreaterThan(0);
      }

      expect(CONSTANTS_2026.qbi.phaseouts[status].start).toBeGreaterThan(0);
      expect(CONSTANTS_2026.qbi.phaseouts[status].end).toBeGreaterThan(0);
    }

    for (const table of [CONSTANTS_2026.fpl, CONSTANTS_2026.fpl2025]) {
      for (const region of fplRegions) {
        for (const size of householdSizes) {
          expect(table[region].householdSize[size]).toBeGreaterThan(0);
        }
        expect(table[region].additionalPerPerson).toBeGreaterThan(0);
      }
    }

    for (const band of CONSTANTS_2026.aca.applicablePercentages) {
      expect(band.fplTo).toBeGreaterThan(0);
      expect(band.initial).toBeGreaterThan(0);
      expect(band.final).toBeGreaterThan(0);
    }

    for (const tiers of Object.values(CONSTANTS_2026.irmaa.partBTiers)) {
      expect(tiers[0]?.partBMonthlyAdjustment).toBe(0);
      expect(tiers[0]?.partDMonthlyAdjustment).toBe(0);

      for (const tier of tiers) {
        if ('magiOver' in tier && tier.magiOver !== null) {
          expect(tier.magiOver).toBeGreaterThan(0);
        }
        if ('magiUpToInclusive' in tier) {
          expect(tier.magiUpToInclusive).toBeGreaterThan(0);
        }
        if ('magiLessThan' in tier) {
          expect(tier.magiLessThan).toBeGreaterThan(0);
        }
        if ('magiAtLeast' in tier) {
          expect(tier.magiAtLeast).toBeGreaterThan(0);
        }
      }

      for (const tier of tiers.slice(1)) {
        expect(tier.partBMonthlyAdjustment).toBeGreaterThan(0);
        expect(tier.partDMonthlyAdjustment).toBeGreaterThan(0);
      }
    }
  });
});
