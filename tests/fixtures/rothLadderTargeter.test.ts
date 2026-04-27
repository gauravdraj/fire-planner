import { describe, expect, it } from 'vitest';

import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import {
  ROTH_LADDER_SOLVER_TOLERANCE_DOLLARS,
  computeRothLadderConversionForYear,
  type RothLadderConstraint,
  type RothLadderConstraintStatus,
} from '@/core/planners/rothLadderTargeter';
import type { Scenario, WithdrawalPlan } from '@/core/projection';

const IRS_REV_PROC_2025_32 =
  'IRS Rev. Proc. 2025-32, 2026 inflation-adjusted tax items, ordinary income brackets, standard deductions, and qualified dividend / capital gain thresholds, retrieved 2026-04-26, https://www.irs.gov/pub/irs-drop/rp-25-32.pdf';
const HHS_FPL_2025 =
  'HHS 2025 Poverty Guidelines, 90 FR 5917, used for 2026 PTC coverage-year calculations, retrieved 2026-04-26, https://www.federalregister.gov/documents/2025/01/17/2025-01377/annual-update-of-the-hhs-poverty-guidelines';
const IRC_36B =
  '26 U.S.C. § 36B, premium assistance credit amount and household income rules, retrieved 2026-04-26, https://uscode.house.gov/view.xhtml?req=(title:26%20section:36B%20edition:prelim)';
const CMS_IRMAA_2026 =
  'CMS 2026 Medicare Parts A & B Premiums and Deductibles fact sheet, retrieved 2026-04-26, https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles';
const SSA_POMS_IRMAA_TABLES =
  'SSA POMS HI 01101.020, 2026 IRMAA sliding scale tables, retrieved 2026-04-26, https://secure.ssa.gov/poms.nsf/lnx/0601101020';

type ExpectedResult = Readonly<{
  status: RothLadderConstraintStatus;
  constraintMet: boolean;
  conversionAmount: number;
  targetValue: number;
  measuredValue: number;
  bindingMargin: number;
  projectedAgi: number;
  taxableIncome: number;
  acaMagi?: number;
  irmaaMagi?: number;
}>;

type RothTargetFixture = Readonly<{
  label: string;
  scenario: Scenario;
  plan: WithdrawalPlan;
  constraint: RothLadderConstraint;
  expected: ExpectedResult;
  worksheetWalk: string;
  citations: readonly string[];
}>;

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

function expectWithinTolerance(actual: number | null, expected: number, toleranceDollars = ROTH_LADDER_SOLVER_TOLERANCE_DOLLARS): void {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual ?? 0) - expected)).toBeLessThanOrEqual(toleranceDollars);
}

/*
 * Expected planner amounts below are hand-entered from worksheet walks using
 * the cited IRS/HHS/CMS/SSA source thresholds. They are not calculated from
 * CONSTANTS_2026 or by reusing production tax/planner helpers.
 */
const fixtures: readonly RothTargetFixture[] = [
  {
    label: 'single filer fills the 12% ordinary bracket with a Roth conversion',
    scenario: makeScenario(),
    plan: makePlan(),
    constraint: { kind: 'federalBracket', bracketRate: 0.12 },
    expected: {
      status: 'constraint-met',
      constraintMet: true,
      conversionAmount: 66_500,
      targetValue: 50_400,
      measuredValue: 50_400,
      bindingMargin: 0,
      projectedAgi: 66_500,
      taxableIncome: 50_400,
      irmaaMagi: 66_500,
    },
    worksheetWalk:
      'Single 2026 standard deduction is $16,100. The 12% ordinary bracket ends before the 22% bracket at $50,400 of taxable income. With no other income and cash available to pay tax, the Roth conversion headroom is $50,400 + $16,100 = $66,500.',
    citations: [IRS_REV_PROC_2025_32],
  },
  {
    label: 'single ACA household targets 200% of 2025 FPL for 2026 coverage',
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
    constraint: { kind: 'acaFplPercentage', maxFplPercent: 2 },
    expected: {
      status: 'constraint-met',
      constraintMet: true,
      conversionAmount: 31_300,
      targetValue: 31_300,
      measuredValue: 31_300,
      bindingMargin: 0,
      projectedAgi: 31_300,
      taxableIncome: 15_200,
      acaMagi: 31_300,
      irmaaMagi: 31_300,
    },
    worksheetWalk:
      '2026 ACA premium tax credit calculations use the 2025 contiguous poverty guideline. Household size 1 FPL is $15,650, and 200% FPL is $15,650 x 2 = $31,300. With no other MAGI addbacks, the Roth conversion target is $31,300.',
    citations: [HHS_FPL_2025, IRC_36B],
  },
  {
    label: 'single filer stays inside the first IRMAA tier ceiling',
    scenario: makeScenario({
      w2Income: [{ year: 2026, amount: 100_000 }],
    }),
    plan: makePlan(),
    constraint: { kind: 'irmaaTier', maxTier: 0 },
    expected: {
      status: 'constraint-met',
      constraintMet: true,
      conversionAmount: 9_000,
      targetValue: 109_000,
      measuredValue: 109_000,
      bindingMargin: 0,
      projectedAgi: 109_000,
      taxableIncome: 92_900,
      irmaaMagi: 109_000,
    },
    worksheetWalk:
      'The 2026 single IRMAA no-surcharge tier applies to MAGI not more than $109,000. Starting W-2 income is $100,000 and there is no tax-exempt interest, so remaining IRMAA MAGI room is $109,000 - $100,000 = $9,000 of Roth conversion.',
    citations: [CMS_IRMAA_2026, SSA_POMS_IRMAA_TABLES],
  },
  {
    label: 'single filer fills the 0% long-term capital gains taxable-income band',
    scenario: makeScenario(),
    plan: makePlan(),
    constraint: { kind: 'ltcgBracket', bracketRate: 0 },
    expected: {
      status: 'constraint-met',
      constraintMet: true,
      conversionAmount: 65_550,
      targetValue: 49_450,
      measuredValue: 49_450,
      bindingMargin: 0,
      projectedAgi: 65_550,
      taxableIncome: 49_450,
      irmaaMagi: 65_550,
    },
    worksheetWalk:
      'The 2026 single 0% qualified dividend / long-term capital gain band ends at $49,450 of taxable income. With no other income, the Roth conversion that reaches that taxable-income stack point is $49,450 + $16,100 standard deduction = $65,550.',
    citations: [IRS_REV_PROC_2025_32],
  },
  {
    label: 'already-exceeded IRMAA target emits zero conversion',
    scenario: makeScenario({
      w2Income: [{ year: 2026, amount: 120_000 }],
    }),
    plan: makePlan(),
    constraint: { kind: 'irmaaTier', maxTier: 0 },
    expected: {
      status: 'already-over-target',
      constraintMet: false,
      conversionAmount: 0,
      targetValue: 109_000,
      measuredValue: 120_000,
      bindingMargin: -11_000,
      projectedAgi: 120_000,
      taxableIncome: 103_900,
      irmaaMagi: 120_000,
    },
    worksheetWalk:
      'The no-surcharge single IRMAA ceiling is $109,000. Base W-2 income is already $120,000, so the household is $11,000 over the target before any Roth conversion and the planner should emit $0.',
    citations: [CMS_IRMAA_2026, SSA_POMS_IRMAA_TABLES],
  },
  {
    label: 'W-2 income partially fills the ordinary bracket before conversion',
    scenario: makeScenario({
      w2Income: [{ year: 2026, amount: 40_000 }],
    }),
    plan: makePlan(),
    constraint: { kind: 'federalBracket', bracketRate: 0.12 },
    expected: {
      status: 'constraint-met',
      constraintMet: true,
      conversionAmount: 26_500,
      targetValue: 50_400,
      measuredValue: 50_400,
      bindingMargin: 0,
      projectedAgi: 66_500,
      taxableIncome: 50_400,
      irmaaMagi: 66_500,
    },
    worksheetWalk:
      'The 2026 single 12% ordinary bracket ceiling is $50,400 taxable income, and the standard deduction is $16,100. The AGI that reaches the ceiling is $66,500. With $40,000 of W-2 income already present, Roth conversion headroom is $66,500 - $40,000 = $26,500.',
    citations: [IRS_REV_PROC_2025_32],
  },
];

describe('Roth ladder targeter source-backed fixtures', () => {
  it('documents the requested fixture breadth with source citations and worksheet walks', () => {
    expect(fixtures).toHaveLength(6);
    expect(fixtures.some(({ constraint }) => constraint.kind === 'irmaaTier')).toBe(true);
    expect(fixtures.some(({ constraint }) => constraint.kind === 'acaFplPercentage')).toBe(true);
    expect(fixtures.some(({ constraint }) => constraint.kind === 'federalBracket')).toBe(true);
    expect(fixtures.some(({ constraint }) => constraint.kind === 'ltcgBracket')).toBe(true);
    expect(fixtures.some(({ expected }) => expected.status === 'already-over-target')).toBe(true);
    expect(fixtures.some(({ label }) => label.includes('W-2'))).toBe(true);

    for (const fixture of fixtures) {
      expect(fixture.worksheetWalk).toMatch(/\$\d/);
      expect(fixture.citations.length).toBeGreaterThan(0);
      expect(fixture.citations.join('; ')).toMatch(/IRS|HHS|CMS|SSA|U\.S\.C\./);
      expect(fixture.citations.join('; ')).toContain('https://');
    }
  });

  it.each(fixtures)('$label', ({ constraint, expected, plan, scenario }) => {
    const result = computeRothLadderConversionForYear({
      scenario,
      plan,
      year: 2026,
      constraint,
    });

    expect(result.status).toBe(expected.status);
    expect(result.constraintMet).toBe(expected.constraintMet);
    expectWithinTolerance(result.conversionAmount, expected.conversionAmount);
    expectWithinTolerance(result.targetValue, expected.targetValue, 0.01);
    expectWithinTolerance(result.measuredValue, expected.measuredValue);
    expectWithinTolerance(result.bindingMargin, expected.bindingMargin);
    expectWithinTolerance(result.projectedAgi, expected.projectedAgi);
    expectWithinTolerance(result.taxableIncome, expected.taxableIncome);

    if (expected.acaMagi !== undefined) {
      expectWithinTolerance(result.acaMagi, expected.acaMagi);
    }
    if (expected.irmaaMagi !== undefined) {
      expectWithinTolerance(result.irmaaMagi, expected.irmaaMagi);
    }
  });
});
