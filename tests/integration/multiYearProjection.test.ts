import { describe, expect, it } from 'vitest';

import { CALIFORNIA_STATE_TAX } from '@/core/constants/states/california';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import { runProjection, type Scenario, type WithdrawalPlan, type YearBreakdown } from '@/core/projection';

const scenario: Scenario = {
  startYear: 2026,
  filingStatus: 'mfj',
  w2Income: [],
  annualContributionTraditional: 0,
  annualContributionRoth: 0,
  annualContributionHsa: 0,
  annualContributionBrokerage: 0,
  consultingIncome: [],
  healthcare: [
    {
      year: 2026,
      kind: 'aca',
      householdSize: 2,
      annualBenchmarkPremium: 18_000,
      annualEnrollmentPremium: 17_000,
    },
    {
      year: 2027,
      kind: 'aca',
      householdSize: 2,
      annualBenchmarkPremium: 18_540,
      annualEnrollmentPremium: 17_510,
    },
    {
      year: 2028,
      kind: 'aca',
      householdSize: 2,
      annualBenchmarkPremium: 19_096.2,
      annualEnrollmentPremium: 18_035.3,
    },
    {
      year: 2029,
      kind: 'aca',
      householdSize: 2,
      annualBenchmarkPremium: 19_669.09,
      annualEnrollmentPremium: 18_576.36,
    },
    {
      year: 2030,
      kind: 'medicare',
    },
  ],
  socialSecurity: {
    claimYear: 2030,
    annualBenefit: 55_000,
    colaRate: 0.02,
  },
  pensionIncome: [],
  annuityIncome: [],
  rentalIncome: [
    {
      year: 2030,
      amount: 18_000,
      cashFlow: 18_000,
      materiallyParticipates: false,
    },
  ],
  state: {
    incomeTaxLaw: CALIFORNIA_STATE_TAX,
  },
  balances: {
    cash: 150_000,
    hsa: 0,
    taxableBrokerage: 1_850_000,
    traditional: 1_000_000,
    roth: 200_000,
  },
  basis: {
    taxableBrokerage: 1_110_000,
  },
  inflationRate: 0.03,
  expectedReturns: {},
  magiHistory: [
    { year: 2024, magi: 95_000 },
    { year: 2025, magi: 100_000 },
  ],
  taxableInterest: [
    { year: 2026, amount: 5_000 },
    { year: 2027, amount: 5_150 },
    { year: 2028, amount: 5_304.5 },
    { year: 2029, amount: 5_463.64 },
    { year: 2030, amount: 5_627.55 },
  ],
  qualifiedDividends: [
    { year: 2026, amount: 20_000 },
    { year: 2027, amount: 20_600 },
    { year: 2028, amount: 21_218 },
    { year: 2029, amount: 21_854.54 },
    { year: 2030, amount: 22_510.18 },
  ],
};

const plan: WithdrawalPlan = {
  endYear: 2030,
  annualSpending: [
    { year: 2026, amount: 110_000 },
    { year: 2027, amount: 113_300 },
    { year: 2028, amount: 116_699 },
    { year: 2029, amount: 120_199.97 },
    { year: 2030, amount: 123_805.97 },
  ],
  rothConversions: [
    { year: 2028, amount: 240_000 },
    { year: 2030, amount: 180_000 },
  ],
};

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

function expectWithinProjectionTolerance(actual: number, expected: number): void {
  const tolerance = Math.max(1, Math.abs(expected) * 0.001);

  expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
  expect(actual).toBeLessThanOrEqual(expected + tolerance);
}

describe('multi-year projection integration', () => {
  it('projects a five-year MFJ early-retirement scenario through ACA and Medicare threshold years', () => {
    const results = runProjection(scenario, plan);
    const yearOne = results[0];
    const yearFive = results[4];

    expect(results).toHaveLength(5);
    expect(results.map((year) => year.year)).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(yearOne).toBeDefined();
    expect(yearFive).toBeDefined();

    if (yearOne === undefined || yearFive === undefined) {
      throw new Error('Expected first and fifth projection years');
    }

    expect(yearOne.openingBalances).toEqual({
      cash: 150_000,
      hsa: 0,
      taxableBrokerage: 1_850_000,
      traditional: 1_000_000,
      roth: 200_000,
    });

    /*
     * Year 1 hand worksheet:
     * - Starting ages: 60-year-old MFJ early retirees; the projection engine does
     *   not enforce age, so healthcare schedule dates drive ACA/Medicare phases.
     * - Cash covers spending: $110,000 spending - $25,000 cash income = $85,000
     *   cash withdrawal; no brokerage sale or Roth conversion in the baseline year.
     * - AGI = $5,000 taxable interest + $20,000 qualified dividends = $25,000.
     * - Taxable income = max($25,000 - $32,200 MFJ standard deduction, $0) = $0.
     * - Ordinary federal tax = $0; qualified dividends remain inside the 0% LTCG band.
     * - 2026 ACA uses 2025 FPL for household size 2: $21,150. MAGI/FPL = 118.2033%,
     *   applicable percentage = 2.10%, required contribution = $525.00.
     * - PTC = min($17,000 enrollment premium, $18,000 benchmark - $525) = $17,000.
     */
    const yearOneTaxableIncome = roundToCents(Math.max(0, yearOne.agi - 32_200));
    expect(yearOne.agi).toBe(25_000);
    expect(yearOneTaxableIncome).toBe(0);
    expect(yearOne.federalTax).toBe(0);
    expect(yearOne.acaPremiumCredit?.premiumTaxCredit).toBe(17_000);

    /*
     * Year 5 hand worksheet:
     * - Healthcare flips to Medicare; IRMAA premium year 2030 looks back two years
     *   to projected 2028 MAGI instead of the 2024/2025 seed history.
     * - Social Security starts in 2030 at $55,000. Provisional income is well above
     *   the MFJ upper threshold, so taxable benefits are capped at 85% = $46,750.
     * - Taxable brokerage sales still use the original 60% basis ratio because this
     *   scenario has no market-return drift: gain = 40% of sale proceeds.
     * - 2030 federal ordinary and LTCG bracket edges are 2026 edges indexed by
     *   1.03^4; the CA starter law intentionally remains the encoded 2025 table.
     * - NIIT applies because AGI is above the $250,000 MFJ threshold and net
     *   investment income includes interest, qualified dividends, brokerage gain,
     *   and passive rental net income.
     * - Selected worksheet values:
     *   opening cash $13,199.84 + brokerage sale $76,560.73 = $89,760.57 withdrawals,
     *   including the $2,884.80 IRMAA surcharge cash outflow;
     *   brokerage basis sold $45,936.44 and gain $30,624.29 at the 60% basis ratio;
     *   ordinary income before Social Security $256,762.02, taxable Social Security
     *   $46,750.00, AGI $303,512.02, taxable income $271,312.02, preferential income
     *   $53,134.47, ordinary taxable income $218,177.55, NIIT base $53,512.02.
     */
    const expectedYearFive: Pick<
      YearBreakdown,
      | 'agi'
      | 'acaMagi'
      | 'irmaaMagi'
      | 'taxableSocialSecurity'
      | 'withdrawals'
      | 'conversions'
      | 'brokerageBasis'
      | 'federalTax'
      | 'ltcgTax'
      | 'niit'
      | 'stateTax'
      | 'totalTax'
    > = {
      agi: 303_512.02,
      acaMagi: 311_762.02,
      irmaaMagi: 303_512.02,
      taxableSocialSecurity: 46_750,
      withdrawals: {
        cash: 13_199.84,
        hsa: 0,
        taxableBrokerage: 76_560.73,
        traditional: 0,
        roth: 0,
      },
      conversions: 180_000,
      brokerageBasis: {
        opening: 965_221.16,
        sold: 45_936.44,
        realizedGainOrLoss: 30_624.29,
        closing: 919_284.72,
      },
      federalTax: 36_095.68,
      ltcgTax: 7_970.17,
      niit: 2_033.46,
      stateTax: 18_109.29,
      totalTax: 64_208.6,
    };

    expect(yearFive.acaPremiumCredit).toBeNull();
    expect(yearFive.irmaaPremium).toMatchObject({
      tier: 2,
      magiSourceYear: 2028,
    });
    expectWithinProjectionTolerance(yearFive.irmaaPremium?.magiUsed ?? 0, 323_669.01);
    expectWithinProjectionTolerance(yearFive.irmaaPremium?.annualIrmaaSurcharge ?? 0, 2_884.8);

    const yearFiveTaxableIncome = roundToCents(Math.max(0, yearFive.agi - 32_200));
    expectWithinProjectionTolerance(yearFiveTaxableIncome, 271_312.02);
    expectWithinProjectionTolerance(yearFive.agi, expectedYearFive.agi);
    expectWithinProjectionTolerance(yearFive.acaMagi, expectedYearFive.acaMagi);
    expectWithinProjectionTolerance(yearFive.irmaaMagi, expectedYearFive.irmaaMagi);
    expectWithinProjectionTolerance(yearFive.taxableSocialSecurity, expectedYearFive.taxableSocialSecurity);
    expectWithinProjectionTolerance(yearFive.withdrawals.cash, expectedYearFive.withdrawals.cash);
    expectWithinProjectionTolerance(yearFive.withdrawals.hsa, expectedYearFive.withdrawals.hsa);
    expectWithinProjectionTolerance(yearFive.withdrawals.taxableBrokerage, expectedYearFive.withdrawals.taxableBrokerage);
    expectWithinProjectionTolerance(yearFive.withdrawals.traditional, expectedYearFive.withdrawals.traditional);
    expectWithinProjectionTolerance(yearFive.withdrawals.roth, expectedYearFive.withdrawals.roth);
    expectWithinProjectionTolerance(yearFive.conversions, expectedYearFive.conversions);
    expectWithinProjectionTolerance(yearFive.brokerageBasis.opening, expectedYearFive.brokerageBasis.opening);
    expectWithinProjectionTolerance(yearFive.brokerageBasis.sold, expectedYearFive.brokerageBasis.sold);
    expectWithinProjectionTolerance(yearFive.brokerageBasis.realizedGainOrLoss, expectedYearFive.brokerageBasis.realizedGainOrLoss);
    expectWithinProjectionTolerance(yearFive.brokerageBasis.closing, expectedYearFive.brokerageBasis.closing);
    expectWithinProjectionTolerance(yearFive.federalTax, expectedYearFive.federalTax);
    expectWithinProjectionTolerance(yearFive.ltcgTax, expectedYearFive.ltcgTax);
    expectWithinProjectionTolerance(yearFive.niit, expectedYearFive.niit);
    expectWithinProjectionTolerance(yearFive.stateTax, expectedYearFive.stateTax);
    expectWithinProjectionTolerance(yearFive.totalTax, expectedYearFive.totalTax);
  });

  it('keeps qualified HSA withdrawals out of AGI and MAGI in a full projection scenario', () => {
    const baselineScenario: Scenario = {
      ...scenario,
      filingStatus: 'single',
      healthcare: [],
      rentalIncome: [],
      state: { incomeTaxLaw: FLORIDA_STATE_TAX },
      balances: {
        cash: 0,
        hsa: 40_000,
        taxableBrokerage: 0,
        traditional: 0,
        roth: 0,
      },
      basis: { taxableBrokerage: 0 },
      taxableInterest: [{ year: 2026, amount: 12_000 }],
      qualifiedDividends: [],
      w2Income: [],
    };
    const [year] = runProjection(
      baselineScenario,
      {
        endYear: 2026,
        annualSpending: [{ year: 2026, amount: 25_000 }],
      },
    );

    expect(year?.withdrawals.hsa).toBe(13_000);
    expect(year?.agi).toBe(12_000);
    expect(year?.acaMagi).toBe(12_000);
    expect(year?.irmaaMagi).toBe(12_000);
  });

  it('runs a ten-year auto-deplete brokerage bridge without first-year failure', () => {
    const { socialSecurity: _ignoredSocialSecurity, ...scenarioWithoutSocialSecurity } = scenario;
    const results = runProjection(
      {
        ...scenarioWithoutSocialSecurity,
        startYear: 2026,
        healthcare: [],
        pensionIncome: [],
        annuityIncome: [],
        rentalIncome: [],
        state: { incomeTaxLaw: FLORIDA_STATE_TAX },
        balances: {
          cash: 0,
          hsa: 0,
          taxableBrokerage: 400_000,
          traditional: 0,
          roth: 0,
        },
        basis: {
          taxableBrokerage: 400_000,
        },
        expectedReturns: {
          taxableBrokerage: 0.05,
        },
        magiHistory: [],
        taxableInterest: [],
        qualifiedDividends: [],
        autoDepleteBrokerage: {
          enabled: true,
          yearsToDeplete: 10,
          annualScaleUpFactor: 0.02,
          excludeMortgageFromRate: false,
          retirementYear: 2026,
        },
      },
      {
        endYear: 2035,
        annualSpending: [],
      },
    );

    expect(results).toHaveLength(10);
    expect(results[0]?.withdrawals.taxableBrokerage).toBeGreaterThan(40_000);
    expect(results[0]?.closingBalances.cash).toBeGreaterThan(40_000);
    expect(results[9]?.closingBalances.taxableBrokerage).toBeLessThan(1);
  });
});
