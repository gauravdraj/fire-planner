import { describe, expect, it } from 'vitest';

import {
  ROTH_LADDER_SOLVER_TOLERANCE_DOLLARS,
  computeRothLadderConversionForYear,
  generateRothLadderPlan,
} from '@/core/planners/rothLadderTargeter';
import { runProjection, type Scenario, type WithdrawalPlan } from '@/core/projection';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';

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
      cash: 100_000,
      hsa: 0,
      taxableBrokerage: 0,
      traditional: 250_000,
      roth: 0,
    },
    basis: {
      taxableBrokerage: 0,
    },
    inflationRate: 0,
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

function expectWithinSolverSlack(value: number | null): asserts value is number {
  expect(value).not.toBeNull();
  expect(Math.abs(value ?? 0)).toBeLessThanOrEqual(ROTH_LADDER_SOLVER_TOLERANCE_DOLLARS);
}

function expectCloseWithinSolverSlack(value: number, expected: number): void {
  expect(Math.abs(value - expected)).toBeLessThanOrEqual(ROTH_LADDER_SOLVER_TOLERANCE_DOLLARS);
}

describe('Roth ladder targeter core', () => {
  it('targets the top of a federal ordinary bracket using projected taxable income', () => {
    const result = computeRothLadderConversionForYear({
      scenario: makeScenario(),
      plan: makePlan(),
      year: 2026,
      constraint: { kind: 'federalBracket', bracketRate: 0.12 },
    });

    // 2026 single standard deduction is $16,100 and the 12% bracket tops at
    // $50,400, so a no-other-income conversion lands near $66,500.
    expect(result.status).toBe('constraint-met');
    expect(result.constraintMet).toBe(true);
    expectCloseWithinSolverSlack(result.conversionAmount, 66_500);
    expectCloseWithinSolverSlack(result.taxableIncome, 50_400);
    expectWithinSolverSlack(result.bindingMargin);
  });

  it('targets ACA FPL percentage using the coverage-year prior FPL table', () => {
    const result = computeRothLadderConversionForYear({
      scenario: makeScenario({
        healthcare: [
          {
            year: 2026,
            kind: 'aca',
            householdSize: 1,
            annualBenchmarkPremium: 9_000,
          },
        ],
      }),
      plan: makePlan(),
      year: 2026,
      constraint: { kind: 'acaFplPercentage', maxFplPercent: 2 },
    });

    // 2026 ACA uses the 2025 contiguous FPL of $15,650 for household size 1.
    expect(result.status).toBe('constraint-met');
    expect(result.constraintMet).toBe(true);
    expectCloseWithinSolverSlack(result.acaMagi, 31_300);
    expectWithinSolverSlack(result.bindingMargin);
  });

  it('reports IRMAA lookback metadata when targeting a tier ceiling', () => {
    const result = computeRothLadderConversionForYear({
      scenario: makeScenario({
        w2Income: [{ year: 2026, amount: 100_000 }],
      }),
      plan: makePlan(),
      year: 2026,
      constraint: { kind: 'irmaaTier', maxTier: 0 },
    });

    expect(result.status).toBe('constraint-met');
    expect(result.constraintMet).toBe(true);
    expectCloseWithinSolverSlack(result.irmaaMagi, 109_000);
    expectCloseWithinSolverSlack(result.conversionAmount, 9_000);
    expect(result.irmaaLookback).toEqual({
      magiYear: 2026,
      premiumYear: 2028,
      lookbackYears: 2,
      note: '2026 IRMAA MAGI drives the 2028 premium bill.',
    });
    expectWithinSolverSlack(result.bindingMargin);
  });

  it('targets the selected LTCG bracket by taxable-income headroom', () => {
    const result = computeRothLadderConversionForYear({
      scenario: makeScenario(),
      plan: makePlan(),
      year: 2026,
      constraint: { kind: 'ltcgBracket', bracketRate: 0 },
    });

    // 2026 single 0% LTCG bracket tops at $49,450 of taxable income.
    expect(result.status).toBe('constraint-met');
    expect(result.constraintMet).toBe(true);
    expectCloseWithinSolverSlack(result.conversionAmount, 65_550);
    expectCloseWithinSolverSlack(result.taxableIncome, 49_450);
    expectWithinSolverSlack(result.bindingMargin);
  });

  it('generates a normal WithdrawalPlan consumable by runProjection', () => {
    const scenario = makeScenario({
      balances: {
        cash: 200_000,
        hsa: 0,
        taxableBrokerage: 0,
        traditional: 250_000,
        roth: 0,
      },
    });
    const generated = generateRothLadderPlan({
      scenario,
      basePlan: makePlan({ endYear: 2027 }),
      constraint: { kind: 'federalBracket', bracketRate: 0.1 },
    });
    const projection = runProjection(scenario, generated.plan);

    expect(generated.years).toHaveLength(2);
    expect(generated.plan.rothConversions?.map((conversion) => conversion.year)).toEqual([2026, 2027]);
    expectCloseWithinSolverSlack(generated.plan.rothConversions?.[0]?.amount ?? 0, 28_500);
    expectCloseWithinSolverSlack(generated.plan.rothConversions?.[1]?.amount ?? 0, 28_500);
    expectCloseWithinSolverSlack(projection[0]?.conversions ?? 0, 28_500);
    expectCloseWithinSolverSlack(projection[1]?.conversions ?? 0, 28_500);
    expectCloseWithinSolverSlack(generated.years[0]?.taxableIncome ?? 0, 12_400);
    expectCloseWithinSolverSlack(generated.years[1]?.taxableIncome ?? 0, 12_400);
  });

  it('keeps conversion at zero when the base projection already exceeds the target', () => {
    const result = computeRothLadderConversionForYear({
      scenario: makeScenario({
        w2Income: [{ year: 2026, amount: 120_000 }],
      }),
      plan: makePlan(),
      year: 2026,
      constraint: { kind: 'irmaaTier', maxTier: 0 },
    });

    expect(result.status).toBe('already-over-target');
    expect(result.constraintMet).toBe(false);
    expect(result.conversionAmount).toBe(0);
    expect(result.bindingMargin).toBeLessThan(0);
  });
});
