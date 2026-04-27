import { describe, expect, it } from 'vitest';

import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import {
  LTCG_HARVESTER_SOLVER_TOLERANCE_DOLLARS,
  computeLtcg0PctHeadroom,
  generateLtcgHarvestPlan,
} from '@/core/planners/ltcgHarvester';
import { runProjection, type Scenario, type WithdrawalPlan } from '@/core/projection';

const SINGLE_STANDARD_DEDUCTION_2026 = 16_100;
const SINGLE_LTCG_ZERO_PERCENT_CEILING_2026 = 49_450;
const SINGLE_IRMAA_TIER_ZERO_CEILING_2026 = 109_000;
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
      hsa: 0,
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

function expectCloseWithinSolverSlack(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(LTCG_HARVESTER_SOLVER_TOLERANCE_DOLLARS);
}

describe('LTCG harvester core', () => {
  it('computes remaining 0% LTCG headroom after ordinary taxable income and already-realized LTCG', () => {
    expect(
      computeLtcg0PctHeadroom({
        filingStatus: 'single',
        ordinaryTaxableIncome: 40_000,
        alreadyRealizedLtcg: 5_000,
      }),
    ).toBe(4_450);

    expect(
      computeLtcg0PctHeadroom({
        filingStatus: 'single',
        ordinaryTaxableIncome: 60_000,
        alreadyRealizedLtcg: 5_000,
      }),
    ).toBe(0);
  });

  it('fills the available 0% LTCG band with brokerage harvests', () => {
    const generated = generateLtcgHarvestPlan({
      scenario: makeScenario(),
      basePlan: makePlan(),
    });
    const [year] = runProjection(makeScenario(), generated.plan);

    expect(generated.years[0]?.status).toBe('harvested');
    expectCloseWithinSolverSlack(generated.years[0]?.harvestAmount ?? 0, SINGLE_STANDARD_DEDUCTION_2026 + SINGLE_LTCG_ZERO_PERCENT_CEILING_2026);
    expectCloseWithinSolverSlack(generated.years[0]?.ltcg0PctHeadroom ?? 0, 0);
    expectCloseWithinSolverSlack(year?.brokerageHarvests ?? 0, generated.years[0]?.harvestAmount ?? 0);
    expect(year?.ltcgTax).toBe(0);
  });

  it('accounts for LTCG already realized by taxable brokerage withdrawals', () => {
    const scenario = makeScenario({
      balances: {
        cash: 0,
        hsa: 0,
        taxableBrokerage: 200_000,
        traditional: 0,
        roth: 0,
      },
    });
    const generated = generateLtcgHarvestPlan({
      scenario,
      basePlan: makePlan({ annualSpending: [{ year: 2026, amount: 20_000 }] }),
    });
    const [year] = runProjection(scenario, generated.plan);

    expectCloseWithinSolverSlack(generated.years[0]?.realizedLtcg ?? 0, SINGLE_STANDARD_DEDUCTION_2026 + SINGLE_LTCG_ZERO_PERCENT_CEILING_2026);
    expectCloseWithinSolverSlack(generated.years[0]?.harvestAmount ?? 0, 55_550);
    expect(year?.ltcgTax).toBe(0);
  });

  it('respects optional per-year max harvest and remaining-unrealized-gain floor limits', () => {
    const maxLimited = generateLtcgHarvestPlan({
      scenario: makeScenario(),
      basePlan: makePlan(),
      maxHarvest: 10_000,
    });
    const floorLimited = generateLtcgHarvestPlan({
      scenario: makeScenario(),
      basePlan: makePlan(),
      remainingUnrealizedGainFloor: 80_000,
    });

    expect(maxLimited.years[0]?.status).toBe('limited-by-max-harvest');
    expect(maxLimited.years[0]?.harvestAmount).toBe(10_000);
    expect(floorLimited.years[0]?.status).toBe('limited-by-unrealized-gain-floor');
    expect(floorLimited.years[0]?.harvestAmount).toBe(20_000);
  });

  it('applies an ACA FPL guard before filling the full 0% LTCG band', () => {
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
    const generated = generateLtcgHarvestPlan({
      scenario,
      basePlan: makePlan(),
      acaGuard: { maxFplPercent: 2 },
    });

    expect(generated.years[0]?.status).toBe('limited-by-aca-guard');
    expectCloseWithinSolverSlack(generated.years[0]?.acaMagi ?? 0, CONTIGUOUS_FPL_2025_HOUSEHOLD_SIZE_1 * 2);
    expect(generated.years[0]?.ltcg0PctHeadroom).toBeGreaterThan(30_000);
  });

  it('applies an IRMAA guard using MAGI that includes tax-exempt interest', () => {
    const generated = generateLtcgHarvestPlan({
      scenario: makeScenario({
        taxExemptInterest: [{ year: 2026, amount: 100_000 }],
      }),
      basePlan: makePlan(),
      irmaaGuard: { maxTier: 0 },
    });

    expect(generated.years[0]?.status).toBe('limited-by-irmaa-guard');
    expectCloseWithinSolverSlack(generated.years[0]?.irmaaMagi ?? 0, SINGLE_IRMAA_TIER_ZERO_CEILING_2026);
    expectCloseWithinSolverSlack(generated.years[0]?.harvestAmount ?? 0, 9_000);
  });
});
