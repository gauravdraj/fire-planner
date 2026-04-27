import { describe, expect, it } from 'vitest';

import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import {
  LTCG_HARVESTER_SOLVER_TOLERANCE_DOLLARS,
  generateLtcgHarvestPlan,
} from '@/core/planners/ltcgHarvester';
import { runProjection, type Scenario, type WithdrawalPlan, type YearBreakdown } from '@/core/projection';

const EXPECTED_ORDINARY_TAX_ON_20K_SINGLE_2026 = 2_152;
const CONTIGUOUS_FPL_2025_HOUSEHOLD_SIZE_1 = 15_650;

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
      taxableBrokerage: 200_000,
      traditional: 0,
      roth: 0,
    },
    basis: {
      taxableBrokerage: 100_000,
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

function expectProjectedYear(year: YearBreakdown | undefined): YearBreakdown {
  expect(year).toBeDefined();
  if (year === undefined) {
    throw new Error('Expected projected year');
  }

  return year;
}

function expectWithinSolverSlack(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(LTCG_HARVESTER_SOLVER_TOLERANCE_DOLLARS);
}

describe('LTCG harvester projection integration', () => {
  it('generated harvests flow through LTCG, MAGI, tax, and brokerage basis without changing brokerage balance', () => {
    const scenario = makeScenario({
      w2Income: [{ year: 2026, amount: 36_100 }],
    });
    const basePlan = makePlan();
    const baseYear = expectProjectedYear(runProjection(scenario, basePlan)[0]);
    const generated = generateLtcgHarvestPlan({
      scenario,
      basePlan,
    });
    const projectedYear = expectProjectedYear(runProjection(scenario, generated.plan)[0]);
    const generatedHarvest = generated.years[0]?.harvestAmount ?? 0;

    expectWithinSolverSlack(generatedHarvest, 29_450);
    expect(generated.plan.brokerageHarvests).toEqual([{ year: 2026, amount: generatedHarvest }]);
    expect(baseYear.brokerageHarvests).toBe(0);
    expectWithinSolverSlack(projectedYear.brokerageHarvests, generatedHarvest);
    expectWithinSolverSlack(projectedYear.brokerageBasis.realizedGainOrLoss, generatedHarvest);
    expectWithinSolverSlack(projectedYear.agi - baseYear.agi, generatedHarvest);
    expectWithinSolverSlack(projectedYear.acaMagi - baseYear.acaMagi, generatedHarvest);
    expectWithinSolverSlack(projectedYear.irmaaMagi - baseYear.irmaaMagi, generatedHarvest);

    expect(baseYear.federalTax).toBe(EXPECTED_ORDINARY_TAX_ON_20K_SINGLE_2026);
    expect(projectedYear.federalTax).toBe(baseYear.federalTax);
    expect(projectedYear.ltcgTax).toBe(0);
    expect(projectedYear.totalTax).toBe(baseYear.totalTax);

    expect(projectedYear.closingBalances.taxableBrokerage).toBe(baseYear.closingBalances.taxableBrokerage);
    expectWithinSolverSlack(projectedYear.brokerageBasis.closing - baseYear.brokerageBasis.closing, generatedHarvest);
  });

  it('ACA guard suppression emits no brokerage harvest and preserves the base projection', () => {
    const scenario = makeScenario({
      w2Income: [{ year: 2026, amount: 31_302 }],
      healthcare: [
        {
          year: 2026,
          kind: 'aca',
          householdSize: 1,
          annualBenchmarkPremium: 9_000,
        },
      ],
    });
    const basePlan = makePlan();
    const generated = generateLtcgHarvestPlan({
      scenario,
      basePlan,
      acaGuard: { maxFplPercent: 2 },
    });
    const baseYear = expectProjectedYear(runProjection(scenario, basePlan)[0]);
    const projectedYear = expectProjectedYear(runProjection(scenario, generated.plan)[0]);

    expect(generated.years[0]?.status).toBe('already-over-aca-guard');
    expect(generated.years[0]?.harvestAmount).toBe(0);
    expect(generated.years[0]?.acaGuardMargin).toBe(-2);
    expect(generated.plan.brokerageHarvests).toEqual([]);
    expect(projectedYear.brokerageHarvests).toBe(0);
    expect(projectedYear.brokerageBasis).toEqual(baseYear.brokerageBasis);
    expect(projectedYear.closingBalances).toEqual(baseYear.closingBalances);
    expect(projectedYear.acaMagi).toBe(CONTIGUOUS_FPL_2025_HOUSEHOLD_SIZE_1 * 2 + 2);
    expect(projectedYear.acaPremiumCredit?.fplPercent).toBeCloseTo((CONTIGUOUS_FPL_2025_HOUSEHOLD_SIZE_1 * 2 + 2) / CONTIGUOUS_FPL_2025_HOUSEHOLD_SIZE_1);
    expect(projectedYear.totalTax).toBe(baseYear.totalTax);
  });
});
