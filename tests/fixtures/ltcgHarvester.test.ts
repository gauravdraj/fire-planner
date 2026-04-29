import { describe, expect, it } from 'vitest';

import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import {
  LTCG_HARVESTER_SOLVER_TOLERANCE_DOLLARS,
  computeLtcg0PctHeadroom,
  generateLtcgHarvestPlan,
  type LtcgHarvestStatus,
} from '@/core/planners/ltcgHarvester';
import type { Scenario, WithdrawalPlan } from '@/core/projection';

const IRS_REV_PROC_2025_32 =
  'IRS Rev. Proc. 2025-32, 2026 inflation-adjusted tax items, standard deductions and qualified dividend / capital gain thresholds, retrieved 2026-04-26, https://www.irs.gov/pub/irs-drop/rp-25-32.pdf';
const HHS_FPL_2025 =
  'HHS 2025 Poverty Guidelines, 90 FR 5917, used for 2026 PTC coverage-year calculations, retrieved 2026-04-26, https://www.federalregister.gov/documents/2025/01/17/2025-01377/annual-update-of-the-hhs-poverty-guidelines';
const IRC_36B =
  '26 U.S.C. section 36B, premium assistance credit household income rules, retrieved 2026-04-26, https://uscode.house.gov/view.xhtml?req=(title:26%20section:36B%20edition:prelim)';

const SINGLE_STANDARD_DEDUCTION_2026 = 16_100;
const SINGLE_LTCG_ZERO_PERCENT_CEILING_2026 = 49_450;
const CONTIGUOUS_FPL_2025_HOUSEHOLD_SIZE_1 = 15_650;

type ExpectedResult = Readonly<{
  status: LtcgHarvestStatus;
  constraintMet: boolean;
  currentTaxableOrdinaryIncome: number;
  alreadyRealizedLtcg: number;
  zeroPercentCeiling: number;
  ltcg0PctHeadroom: number;
  suggestedHarvest: number;
  resultingPreferentialTaxableIncome: number;
  resultingAcaMagi: number;
  acaGuardMargin: number | null;
}>;

type LtcgHarvesterFixture = Readonly<{
  label: string;
  scenario: Scenario;
  plan: WithdrawalPlan;
  acaGuard?: { maxFplPercent: number };
  expected: ExpectedResult;
  worksheetWalk: string;
  citations: readonly string[];
}>;

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

function expectWithinSolverSlack(actual: number | null, expected: number): void {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual ?? 0) - expected)).toBeLessThanOrEqual(LTCG_HARVESTER_SOLVER_TOLERANCE_DOLLARS);
}

/*
 * Expected values are hand-entered from worksheet walks using the cited
 * IRS/HHS statutory thresholds. They are not calculated from CONSTANTS_2026 or
 * reused from production planner internals.
 */
const fixtures: readonly LtcgHarvesterFixture[] = [
  {
    label: 'full headroom when the single filer has no current taxable income',
    scenario: makeScenario(),
    plan: makePlan(),
    expected: {
      status: 'harvested',
      constraintMet: true,
      currentTaxableOrdinaryIncome: 0,
      alreadyRealizedLtcg: 0,
      zeroPercentCeiling: SINGLE_LTCG_ZERO_PERCENT_CEILING_2026,
      ltcg0PctHeadroom: 49_450,
      suggestedHarvest: 65_550,
      resultingPreferentialTaxableIncome: 49_450,
      resultingAcaMagi: 65_550,
      acaGuardMargin: null,
    },
    worksheetWalk:
      'Single 2026 standard deduction is $16,100 and the 0% qualified dividend / long-term capital gain ceiling is $49,450 of taxable income. With $0 current ordinary taxable income and $0 already-realized LTCG, taxable 0% headroom is $49,450. The harvest can realize $16,100 + $49,450 = $65,550 because the standard deduction shelters the first dollars of gain.',
    citations: [IRS_REV_PROC_2025_32],
  },
  {
    label: 'partial headroom after W-2 income consumes part of the 0% band',
    scenario: makeScenario({
      w2Income: [{ year: 2026, amount: 36_100 }],
    }),
    plan: makePlan(),
    expected: {
      status: 'harvested',
      constraintMet: true,
      currentTaxableOrdinaryIncome: 20_000,
      alreadyRealizedLtcg: 0,
      zeroPercentCeiling: SINGLE_LTCG_ZERO_PERCENT_CEILING_2026,
      ltcg0PctHeadroom: 29_450,
      suggestedHarvest: 29_450,
      resultingPreferentialTaxableIncome: 29_450,
      resultingAcaMagi: 65_550,
      acaGuardMargin: null,
    },
    worksheetWalk:
      'W-2 income of $36,100 minus the $16,100 single standard deduction leaves $20,000 current ordinary taxable income. The single 0% LTCG ceiling is $49,450, so remaining taxable headroom is $49,450 - $20,000 = $29,450. No standard deduction remains for preferential income, so suggested harvest is $29,450.',
    citations: [IRS_REV_PROC_2025_32],
  },
  {
    label: 'zero headroom when ordinary income already exceeds the 0% ceiling',
    scenario: makeScenario({
      w2Income: [{ year: 2026, amount: 75_550 }],
    }),
    plan: makePlan(),
    expected: {
      status: 'no-ltcg-headroom',
      constraintMet: false,
      currentTaxableOrdinaryIncome: 59_450,
      alreadyRealizedLtcg: 0,
      zeroPercentCeiling: SINGLE_LTCG_ZERO_PERCENT_CEILING_2026,
      ltcg0PctHeadroom: 0,
      suggestedHarvest: 0,
      resultingPreferentialTaxableIncome: 0,
      resultingAcaMagi: 75_550,
      acaGuardMargin: null,
    },
    worksheetWalk:
      'W-2 income of $75,550 minus the $16,100 single standard deduction leaves $59,450 current ordinary taxable income. That is $10,000 above the $49,450 single 0% LTCG ceiling, so remaining 0% headroom and suggested harvest are both $0.',
    citations: [IRS_REV_PROC_2025_32],
  },
  {
    label: 'ACA guard suppresses harvest when base MAGI already exceeds 200% FPL',
    scenario: makeScenario({
      w2Income: [{ year: 2026, amount: 31_302 }],
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
    acaGuard: { maxFplPercent: 2 },
    expected: {
      status: 'already-over-aca-guard',
      constraintMet: false,
      currentTaxableOrdinaryIncome: 15_202,
      alreadyRealizedLtcg: 0,
      zeroPercentCeiling: SINGLE_LTCG_ZERO_PERCENT_CEILING_2026,
      ltcg0PctHeadroom: 34_248,
      suggestedHarvest: 0,
      resultingPreferentialTaxableIncome: 0,
      resultingAcaMagi: 31_302,
      acaGuardMargin: -2,
    },
    worksheetWalk:
      'For 2026 ACA coverage, the planner uses the 2025 contiguous poverty guideline. Household size 1 FPL is $15,650, and 200% FPL is $31,300. Base W-2 income already puts ACA MAGI at $31,302, while taxable ordinary income is $31,302 - $16,100 = $15,202. Although LTCG 0% taxable headroom is $49,450 - $15,202 = $34,248, the ACA guard is exceeded by $2 before harvesting, so suggested harvest is suppressed to $0.',
    citations: [IRS_REV_PROC_2025_32, HHS_FPL_2025, IRC_36B],
  },
];

describe('LTCG harvester source-backed fixtures', () => {
  it('documents required fixture breadth with source citations and worksheet walks', () => {
    expect(fixtures).toHaveLength(4);
    expect(fixtures.some(({ label }) => label.includes('full headroom'))).toBe(true);
    expect(fixtures.some(({ label }) => label.includes('partial headroom'))).toBe(true);
    expect(fixtures.some(({ label }) => label.includes('zero headroom'))).toBe(true);
    expect(fixtures.some(({ label }) => label.includes('ACA guard'))).toBe(true);

    for (const fixture of fixtures) {
      expect(fixture.worksheetWalk).toMatch(/\$\d/);
      expect(fixture.citations.length).toBeGreaterThan(0);
      expect(fixture.citations.join('; ')).toMatch(/IRS|HHS|U\.S\.C\./);
      expect(fixture.citations.join('; ')).toContain('https://');
    }
  });

  it.each(fixtures)('$label', ({ acaGuard, expected, plan, scenario }) => {
    const taxableBandHeadroom = computeLtcg0PctHeadroom({
      filingStatus: scenario.filingStatus,
      ordinaryTaxableIncome: expected.currentTaxableOrdinaryIncome,
      alreadyRealizedLtcg: expected.alreadyRealizedLtcg,
    });
    const generated = generateLtcgHarvestPlan({
      scenario,
      basePlan: plan,
      ...(acaGuard !== undefined ? { acaGuard } : {}),
    });
    const result = generated.years[0];

    expect(result).toBeDefined();
    if (result === undefined) {
      throw new Error('Expected generated LTCG harvest year');
    }

    expect(expected.zeroPercentCeiling).toBe(SINGLE_LTCG_ZERO_PERCENT_CEILING_2026);
    expect(taxableBandHeadroom).toBe(
      Math.max(0, expected.zeroPercentCeiling - expected.currentTaxableOrdinaryIncome - expected.alreadyRealizedLtcg),
    );
    expect(taxableBandHeadroom).toBe(expected.ltcg0PctHeadroom);
    expect(result.status).toBe(expected.status);
    expect(result.constraintMet).toBe(expected.constraintMet);
    expectWithinSolverSlack(result.ordinaryTaxableIncome, expected.currentTaxableOrdinaryIncome);
    expectWithinSolverSlack(result.preferentialTaxableIncome, expected.resultingPreferentialTaxableIncome);
    expectWithinSolverSlack(result.harvestAmount, expected.suggestedHarvest);
    expectWithinSolverSlack(result.acaMagi, expected.resultingAcaMagi);

    if (expected.suggestedHarvest > 0) {
      expectWithinSolverSlack(result.ltcg0PctHeadroom, 0);
    } else {
      expectWithinSolverSlack(result.ltcg0PctHeadroom, expected.ltcg0PctHeadroom);
    }

    if (expected.acaGuardMargin === null) {
      expect(result.acaGuardMargin).toBeNull();
    } else {
      expectWithinSolverSlack(result.acaGuardMargin, expected.acaGuardMargin);
    }
    if (acaGuard !== undefined) {
      const guardMargin = expected.acaGuardMargin;
      expect(guardMargin).not.toBeNull();
      if (guardMargin === null) {
        throw new Error('ACA guard fixture must include an expected guard margin');
      }

      expect(result.acaGuardMargin).toBe(guardMargin);
      expect(CONTIGUOUS_FPL_2025_HOUSEHOLD_SIZE_1 * acaGuard.maxFplPercent).toBe(
        expected.resultingAcaMagi + guardMargin,
      );
    }
  });
});
