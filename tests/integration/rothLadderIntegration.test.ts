import { describe, expect, it } from 'vitest';

import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import {
  ROTH_LADDER_SOLVER_TOLERANCE_DOLLARS,
  generateRothLadderPlan,
} from '@/core/planners/rothLadderTargeter';
import { runProjection, type Scenario, type WithdrawalPlan, type YearBreakdown } from '@/core/projection';

const SINGLE_STANDARD_DEDUCTION_2026 = 16_100;
const SINGLE_ORDINARY_12_PERCENT_CEILING_2026 = 50_400;
const SINGLE_LTCG_ZERO_PERCENT_CEILING_2026 = 49_450;
const SINGLE_IRMAA_TIER_ZERO_CEILING_2026 = 109_000;
const CONTIGUOUS_FPL_2025_HOUSEHOLD_SIZE_1 = 15_650;

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    startYear: 2026,
    filingStatus: 'single',
    w2Income: [],
    annualContributionTraditional: 0,
    annualContributionRoth: 0,
    annualContributionHsa: 0,
    annualContributionBrokerage: 0,
    consultingIncome: [],
    healthcare: [],
    pensionIncome: [],
    annuityIncome: [],
    rentalIncome: [],
    state: { incomeTaxLaw: FLORIDA_STATE_TAX },
    balances: {
      cash: 150_000,
      hsa: 0,
      taxableBrokerage: 0,
      traditional: 500_000,
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

function taxableIncomeFromProjection(year: YearBreakdown): number {
  return Math.max(0, year.agi - SINGLE_STANDARD_DEDUCTION_2026 - year.qbiDeduction);
}

function expectAtOrBelow(actual: number, ceiling: number): void {
  expect(actual).toBeLessThanOrEqual(ceiling + ROTH_LADDER_SOLVER_TOLERANCE_DOLLARS);
}

function expectCloseWithinSolverSlack(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(ROTH_LADDER_SOLVER_TOLERANCE_DOLLARS);
}

describe('Roth ladder targeter projection integration', () => {
  it('keeps generated federal-bracket conversions inside the projected taxable-income ceiling', () => {
    const scenario = makeScenario();
    const generated = generateRothLadderPlan({
      scenario,
      basePlan: makePlan({ endYear: 2027 }),
      constraint: { kind: 'federalBracket', bracketRate: 0.12 },
    });
    const projection = runProjection(scenario, generated.plan);

    expect(projection.map((year) => year.year)).toEqual([2026, 2027]);
    expect(generated.plan.rothConversions).toHaveLength(2);

    for (const [index, projectedYear] of projection.entries()) {
      const generatedYear = generated.years[index];

      expect(generatedYear).toBeDefined();
      if (generatedYear === undefined) {
        throw new Error('Expected generated Roth ladder year');
      }

      expectCloseWithinSolverSlack(projectedYear.conversions, generatedYear.conversionAmount);
      expectAtOrBelow(taxableIncomeFromProjection(projectedYear), SINGLE_ORDINARY_12_PERCENT_CEILING_2026);
    }
  });

  it('keeps generated ACA-targeted conversions inside the projected FPL percentage cap', () => {
    const scenario = makeScenario({
      healthcare: [
        {
          year: 2026,
          kind: 'aca',
          householdSize: 1,
          annualBenchmarkPremium: 9_000,
        },
      ],
    });
    const generated = generateRothLadderPlan({
      scenario,
      basePlan: makePlan(),
      constraint: { kind: 'acaFplPercentage', maxFplPercent: 2 },
    });
    const [projectedYear] = runProjection(scenario, generated.plan);

    expect(projectedYear).toBeDefined();
    if (projectedYear === undefined) {
      throw new Error('Expected projected year');
    }

    expectCloseWithinSolverSlack(projectedYear.conversions, generated.years[0]?.conversionAmount ?? 0);
    expectAtOrBelow(projectedYear.acaMagi, CONTIGUOUS_FPL_2025_HOUSEHOLD_SIZE_1 * 2);
    expect(projectedYear.acaPremiumCredit?.fplPercent).toBeLessThanOrEqual(2 + 0.0001);
  });

  it('keeps generated IRMAA-targeted conversions inside the projected tier ceiling', () => {
    const scenario = makeScenario({
      w2Income: [{ year: 2026, amount: 100_000 }],
    });
    const generated = generateRothLadderPlan({
      scenario,
      basePlan: makePlan(),
      constraint: { kind: 'irmaaTier', maxTier: 0 },
    });
    const [projectedYear] = runProjection(scenario, generated.plan);

    expect(projectedYear).toBeDefined();
    if (projectedYear === undefined) {
      throw new Error('Expected projected year');
    }

    expectCloseWithinSolverSlack(projectedYear.conversions, generated.years[0]?.conversionAmount ?? 0);
    expectAtOrBelow(projectedYear.irmaaMagi, SINGLE_IRMAA_TIER_ZERO_CEILING_2026);
  });

  it('keeps generated LTCG-bracket conversions inside the projected taxable-income ceiling', () => {
    const scenario = makeScenario();
    const generated = generateRothLadderPlan({
      scenario,
      basePlan: makePlan(),
      constraint: { kind: 'ltcgBracket', bracketRate: 0 },
    });
    const [projectedYear] = runProjection(scenario, generated.plan);

    expect(projectedYear).toBeDefined();
    if (projectedYear === undefined) {
      throw new Error('Expected projected year');
    }

    expectCloseWithinSolverSlack(projectedYear.conversions, generated.years[0]?.conversionAmount ?? 0);
    expectAtOrBelow(taxableIncomeFromProjection(projectedYear), SINGLE_LTCG_ZERO_PERCENT_CEILING_2026);
  });
});
