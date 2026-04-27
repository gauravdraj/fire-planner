import { describe, expect, it } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import {
  effectiveConstants,
  isCustomLawActive,
  sparseDeepMerge,
  type CustomLaw,
} from '@/core/constants/customLaw';
import { runProjection, type Scenario, type WithdrawalPlan } from '@/core/projection';

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    startYear: 2026,
    filingStatus: 'single',
    w2Income: [],
    consultingIncome: [],
    healthcare: [],
    pensionIncome: [],
    annuityIncome: [],
    rentalIncome: [],
    state: { incomeTaxLaw: FLORIDA_STATE_TAX },
    balances: {
      cash: 0,
      taxableBrokerage: 0,
      traditional: 0,
      roth: 0,
    },
    basis: {
      taxableBrokerage: 0,
    },
    inflationRate: 0.03,
    expectedReturns: {},
    ...overrides,
  };
}

function makePlan(overrides: Partial<WithdrawalPlan> = {}): WithdrawalPlan {
  return {
    endYear: 2026,
    annualSpending: [],
    ...overrides,
  };
}

describe('custom law constants', () => {
  it('applies sparse partial overrides while retaining default siblings', () => {
    const constants = effectiveConstants({
      customLaw: {
        federal: {
          standardDeduction: {
            single: 20_000,
          },
        },
        niit: {
          rate: 0.05,
        },
      },
    });

    expect(constants.federal.standardDeduction.single).toBe(20_000);
    expect(constants.federal.standardDeduction.mfj).toBe(CONSTANTS_2026.federal.standardDeduction.mfj);
    expect(constants.federal.ordinaryBrackets.single).toEqual(CONSTANTS_2026.federal.ordinaryBrackets.single);
    expect(constants.niit.rate).toBe(0.05);
    expect(constants.niit.magiThresholds).toEqual(CONSTANTS_2026.niit.magiThresholds);
  });

  it('treats missing or empty sparse overrides as reset/inactive state', () => {
    expect(isCustomLawActive(undefined)).toBe(false);
    expect(isCustomLawActive({})).toBe(false);
    expect(isCustomLawActive({ federal: {} })).toBe(false);
    expect(isCustomLawActive({ federal: { standardDeduction: {} } })).toBe(false);
    expect(isCustomLawActive({ federal: { ordinaryBrackets: { single: [] } } })).toBe(true);

    expect(effectiveConstants({})).toBe(CONSTANTS_2026);
    expect(effectiveConstants({ customLaw: {} })).toBe(CONSTANTS_2026);
    expect(effectiveConstants({ customLaw: { federal: { standardDeduction: {} } } })).toBe(CONSTANTS_2026);
  });

  it('replaces array overrides instead of merging bracket arrays by index', () => {
    const customLaw: CustomLaw = {
      federal: {
        ordinaryBrackets: {
          single: [{ from: 0, rate: 0.5 }],
        },
      },
      ltcg: {
        brackets: {
          single: [{ from: 0, rate: 0.2 }],
        },
      },
    };

    const constants = effectiveConstants({ customLaw });

    expect(constants.federal.ordinaryBrackets.single).toEqual([{ from: 0, rate: 0.5 }]);
    expect(constants.federal.ordinaryBrackets.single).toHaveLength(1);
    expect(constants.federal.ordinaryBrackets.mfj).toEqual(CONSTANTS_2026.federal.ordinaryBrackets.mfj);
    expect(constants.ltcg.brackets.single).toEqual([{ from: 0, rate: 0.2 }]);
    expect(constants.ltcg.brackets.single).toHaveLength(1);
  });

  it('deep-merges nested objects and clones replacement arrays', () => {
    type MergeShape = Readonly<{
      nested: Readonly<{
        a: number;
        b: number;
      }>;
      rows: readonly Readonly<{
        from: number;
        rate: number;
      }>[];
    }>;
    const base: MergeShape = {
      nested: { a: 1, b: 2 },
      rows: [
        { from: 0, rate: 0.1 },
        { from: 10_000, rate: 0.2 },
      ],
    };

    const merged = sparseDeepMerge<MergeShape>(base, {
      nested: { b: 3 },
      rows: [{ from: 0, rate: 0.4 }],
    });

    expect(merged).toEqual({
      nested: { a: 1, b: 3 },
      rows: [{ from: 0, rate: 0.4 }],
    });
    expect(merged.rows).not.toBe(base.rows);
    expect(base).toEqual({
      nested: { a: 1, b: 2 },
      rows: [
        { from: 0, rate: 0.1 },
        { from: 10_000, rate: 0.2 },
      ],
    });
  });

  it('does not mutate the sealed default constants after applying overrides', () => {
    const originalSingleStandardDeduction = CONSTANTS_2026.federal.standardDeduction.single;
    const originalSingleOrdinaryBrackets = [...CONSTANTS_2026.federal.ordinaryBrackets.single];
    const originalNiitRate = CONSTANTS_2026.niit.rate;

    const constants = effectiveConstants({
      customLaw: {
        federal: {
          standardDeduction: { single: 1 },
          ordinaryBrackets: { single: [{ from: 0, rate: 0.99 }] },
        },
        niit: { rate: 0.01 },
      },
    });

    expect(constants).not.toBe(CONSTANTS_2026);
    expect(Object.isFrozen(CONSTANTS_2026)).toBe(true);
    expect(Object.isFrozen(CONSTANTS_2026.federal.ordinaryBrackets.single)).toBe(true);
    expect(CONSTANTS_2026.federal.standardDeduction.single).toBe(originalSingleStandardDeduction);
    expect(CONSTANTS_2026.federal.ordinaryBrackets.single).toEqual(originalSingleOrdinaryBrackets);
    expect(CONSTANTS_2026.niit.rate).toBe(originalNiitRate);
  });

  it('feeds supported overrides into projection tax calculations', () => {
    const [year] = runProjection(
      makeScenario({
        w2Income: [{ year: 2026, amount: 50_000 }],
        taxableInterest: [{ year: 2026, amount: 300_000 }],
        qualifiedDividends: [{ year: 2026, amount: 100_000 }],
        customLaw: {
          federal: {
            standardDeduction: { single: 0 },
            ordinaryBrackets: { single: [{ from: 0, rate: 0.5 }] },
          },
          ltcg: {
            brackets: { single: [{ from: 0, rate: 0.2 }] },
          },
          niit: { rate: 0.05 },
        },
      }),
      makePlan(),
    );

    expect(year?.federalTax).toBe(175_000);
    expect(year?.ltcgTax).toBe(20_000);
    expect(year?.niit).toBe(12_500);
  });
});
