import { describe, expect, it } from 'vitest';

import { computeAutoDepleteSchedule } from '@/core/autoDepleteBrokerage';
import { CONSTANTS_2026 } from '@/core/constants/2026';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import { PENNSYLVANIA_STATE_TAX } from '@/core/constants/states/pennsylvania';
import { indexBracketsForYear, runProjection, type Scenario, type WithdrawalPlan } from '@/core/projection';
import { getFPLForCoverageYear } from '@/core/tax/aca';

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
      hsa: 0,
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

describe('Gate 2 projection indexing helpers', () => {
  it('leaves 2026 and earlier bracket edges unchanged', () => {
    const indexed2026 = indexBracketsForYear(CONSTANTS_2026.federal.ordinaryBrackets, 2026, 0.03);
    const indexed2025 = indexBracketsForYear(CONSTANTS_2026.federal.ordinaryBrackets, 2025, 0.03);

    expect(indexed2026.single[1]?.from).toBe(12_400);
    expect(indexed2026.single[1]?.rate).toBe(0.12);
    expect(indexed2025.mfj[2]?.from).toBe(100_800);
    expect(indexed2025.mfj[2]?.rate).toBe(0.22);
  });

  it('indexes copied ordinary bracket edges after 2026 without mutating constants', () => {
    const indexed = indexBracketsForYear(CONSTANTS_2026.federal.ordinaryBrackets, 2028, 0.05);

    expect(indexed.single).not.toBe(CONSTANTS_2026.federal.ordinaryBrackets.single);
    expect(indexed.single[1]).not.toBe(CONSTANTS_2026.federal.ordinaryBrackets.single[1]);
    expect(indexed.single[1]?.from).toBeCloseTo(12_400 * 1.05 ** 2, 10);
    expect(indexed.single[1]?.rate).toBe(0.12);

    expect(CONSTANTS_2026.federal.ordinaryBrackets.single[1]?.from).toBe(12_400);
    expect(CONSTANTS_2026.federal.ordinaryBrackets.single[1]?.rate).toBe(0.12);
  });

  it('supports LTCG and QBI threshold shapes with explicit edge keys', () => {
    const indexedLtcg = indexBracketsForYear(CONSTANTS_2026.ltcg.brackets, 2027, 0.02);
    const indexedQbi = indexBracketsForYear(CONSTANTS_2026.qbi.phaseouts, 2027, 0.02, ['start', 'end']);

    expect(indexedLtcg.mfj[1]?.from).toBeCloseTo(98_900 * 1.02, 10);
    expect(indexedLtcg.mfj[1]?.rate).toBe(0.15);
    expect(indexedQbi.single.start).toBeCloseTo(201_750 * 1.02, 10);
    expect(indexedQbi.single.end).toBeCloseTo(276_750 * 1.02, 10);

    expect(CONSTANTS_2026.ltcg.brackets.mfj[1]?.from).toBe(98_900);
    expect(CONSTANTS_2026.qbi.phaseouts.single).toEqual({ start: 201_750, end: 276_750 });
  });

  it('indexes unpublished prior-year FPL tables from the latest published FPL constants', () => {
    const futureFpl = getFPLForCoverageYear({ coverageYear: 2029, fplIndexingRate: 0.04 });

    expect(futureFpl.year).toBe(2028);
    expect(futureFpl.indexedFromYear).toBe(2026);
    expect(futureFpl.indexingRate).toBe(0.04);
    expect(futureFpl.source).toContain('indexed from 2026 for projection years');
    expect(futureFpl.contiguous.householdSize[1]).toBe(17_262);
    expect(futureFpl.contiguous.additionalPerPerson).toBe(6_143);

    expect(CONSTANTS_2026.fpl.year).toBe(2026);
    expect(CONSTANTS_2026.fpl.contiguous.householdSize[1]).toBe(15_960);
    expect(CONSTANTS_2026.fpl.contiguous.additionalPerPerson).toBe(5_680);
  });
});

describe('Gate 2 multi-year projection engine', () => {
  it('returns one breakdown per year and indexes Social Security only after the claim year', () => {
    const results = runProjection(
      makeScenario({
        startYear: 2026,
        socialSecurity: {
          claimYear: 2027,
          annualBenefit: 12_000,
          colaRate: 0.02,
        },
      }),
      makePlan({ endYear: 2028 }),
    );

    expect(results).toHaveLength(3);
    expect(results.map((year) => year.year)).toEqual([2026, 2027, 2028]);
    expect(results[0]?.acaMagi).toBe(0);
    expect(results[1]?.acaMagi).toBe(12_000);
    expect(results[2]?.acaMagi).toBe(12_240);
    expect(results[2]?.taxableSocialSecurity).toBe(0);
  });

  it('uses cash before taxable brokerage and tracks weighted-average basis on sales', () => {
    const [year] = runProjection(
      makeScenario({
        healthcare: [
          {
            year: 2026,
            kind: 'aca',
            householdSize: 1,
            annualBenchmarkPremium: 8_400,
          },
        ],
        balances: {
          cash: 5_000,
          hsa: 0,
          taxableBrokerage: 100_000,
          traditional: 0,
          roth: 0,
        },
        basis: {
          taxableBrokerage: 50_000,
        },
      }),
      makePlan({
        annualSpending: [{ year: 2026, amount: 10_000 }],
      }),
    );

    expect(year?.withdrawals).toMatchObject({
      cash: 5_000,
      hsa: 0,
      taxableBrokerage: 5_000,
      traditional: 0,
      roth: 0,
    });
    expect(year?.brokerageBasis).toMatchObject({
      opening: 50_000,
      sold: 2_500,
      realizedGainOrLoss: 2_500,
      closing: 47_500,
    });
    expect(year?.warnings.join(' ')).toContain('ACA MAGI');
  });

  it('treats absent advanced plan actions the same as explicit empty actions', () => {
    const scenario = makeScenario({
      balances: {
        cash: 5_000,
        hsa: 0,
        taxableBrokerage: 100_000,
        traditional: 50_000,
        roth: 25_000,
      },
      basis: {
        taxableBrokerage: 60_000,
      },
    });
    const basePlan = makePlan({
      annualSpending: [{ year: 2026, amount: 20_000 }],
    });

    const baseResults = runProjection(scenario, basePlan);
    const explicitEmptyResults = runProjection(scenario, {
      ...basePlan,
      rothConversions: [],
      brokerageHarvests: [],
    });

    expect(baseResults).toEqual(explicitEmptyResults);
    expect(baseResults[0]?.brokerageHarvests).toBe(0);
  });

  it('flows manual Roth conversions and brokerage harvests through projection outputs', () => {
    const [year] = runProjection(
      makeScenario({
        balances: {
          cash: 0,
          hsa: 0,
          taxableBrokerage: 100_000,
          traditional: 50_000,
          roth: 0,
        },
        basis: {
          taxableBrokerage: 60_000,
        },
      }),
      makePlan({
        rothConversions: [{ year: 2026, amount: 10_000 }],
        brokerageHarvests: [{ year: 2026, amount: 8_000 }],
      }),
    );

    expect(year?.withdrawals).toEqual({
      cash: 0,
      hsa: 0,
      taxableBrokerage: 0,
      traditional: 0,
      roth: 0,
    });
    expect(year?.conversions).toBe(10_000);
    expect(year?.brokerageHarvests).toBe(8_000);
    expect(year?.agi).toBe(18_000);
    expect(year?.brokerageBasis).toEqual({
      opening: 60_000,
      sold: 12_000,
      realizedGainOrLoss: 8_000,
      closing: 68_000,
    });
    expect(year?.closingBalances).toEqual({
      cash: 0,
      hsa: 0,
      taxableBrokerage: 100_000,
      traditional: 40_000,
      roth: 10_000,
    });
    expect(year?.ltcgTax).toBe(0);
  });

  it('treats HSA withdrawals as qualified tax-free withdrawals with expected returns', () => {
    const [year] = runProjection(
      makeScenario({
        balances: {
          cash: 0,
          hsa: 50_000,
          taxableBrokerage: 0,
          traditional: 0,
          roth: 0,
        },
        expectedReturns: {
          hsa: 0.05,
        },
      }),
      makePlan({
        annualSpending: [{ year: 2026, amount: 20_000 }],
      }),
    );

    expect(year?.withdrawals).toEqual({
      cash: 0,
      hsa: 20_000,
      taxableBrokerage: 0,
      traditional: 0,
      roth: 0,
    });
    expect(year?.gainsOrLosses.hsa).toBe(2_500);
    expect(year?.closingBalances.hsa).toBe(32_500);
    expect(year?.agi).toBe(0);
    expect(year?.acaMagi).toBe(0);
    expect(year?.irmaaMagi).toBe(0);
    expect(year?.totalTax).toBe(0);
  });

  it('adds mortgage P&I as fixed spending through payoff year without inflating it', () => {
    const results = runProjection(
      makeScenario({
        mortgage: {
          annualPI: 12_000,
          payoffYear: 2027,
        },
        balances: {
          cash: 500_000,
          hsa: 0,
          taxableBrokerage: 0,
          traditional: 0,
          roth: 0,
        },
      }),
      makePlan({
        endYear: 2028,
        annualSpending: [
          { year: 2026, amount: 100_000 },
          { year: 2027, amount: 103_000 },
          { year: 2028, amount: 106_090 },
        ],
      }),
    );

    expect(results.map((year) => year.spending)).toEqual([112_000, 115_000, 106_090]);
    expect(results.map((year) => year.withdrawals.cash)).toEqual([112_000, 115_000, 106_090]);
  });

  it('generates brokerage dividends from opening taxable brokerage and splits qualified dividends', () => {
    const [year] = runProjection(
      makeScenario({
        balances: {
          cash: 0,
          hsa: 0,
          taxableBrokerage: 100_000,
          traditional: 0,
          roth: 0,
        },
        basis: {
          taxableBrokerage: 100_000,
        },
        brokerageDividends: {
          annualYield: 0.02,
          qdiPercentage: 0.95,
        },
      }),
      makePlan(),
    );

    expect(year?.brokerageDividends).toEqual({
      ordinary: 100,
      qualified: 1_900,
      total: 2_000,
      afterTaxReinvested: 2_000,
    });
    expect(year?.agi).toBe(2_000);
    expect(year?.closingBalances.taxableBrokerage).toBe(102_000);
    expect(year?.brokerageBasis.closing).toBe(102_000);
  });

  it('treats brokerage expected return as price appreciation when dividend yield is modeled', () => {
    const [year] = runProjection(
      makeScenario({
        balances: {
          cash: 0,
          hsa: 0,
          taxableBrokerage: 100_000,
          traditional: 0,
          roth: 0,
        },
        basis: {
          taxableBrokerage: 100_000,
        },
        expectedReturns: {
          taxableBrokerage: 0.05,
        },
        brokerageDividends: {
          annualYield: 0.02,
          qdiPercentage: 0.95,
        },
      }),
      makePlan(),
    );

    expect(year?.gainsOrLosses.taxableBrokerage).toBe(5_000);
    expect(year?.brokerageDividends?.afterTaxReinvested).toBe(2_000);
    expect(year?.closingBalances.taxableBrokerage).toBe(107_000);
    expect(year?.brokerageBasis.closing).toBe(102_000);
  });

  it('applies auto-deplete brokerage draws as forced taxable brokerage withdrawals before HSA allocation', () => {
    const expectedDraw = computeAutoDepleteSchedule(400_000, 10, 0.02, 0.05)[0]!;
    const [year] = runProjection(
      makeScenario({
        balances: {
          cash: 0,
          hsa: 100_000,
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
        autoDepleteBrokerage: {
          enabled: true,
          yearsToDeplete: 10,
          annualScaleUpFactor: 0.02,
          excludeMortgageFromRate: false,
          retirementYear: 2026,
        },
      }),
      makePlan({
        annualSpending: [{ year: 2026, amount: 60_000 }],
      }),
    );

    expect(year?.withdrawals.taxableBrokerage).toBeCloseTo(expectedDraw, 2);
    expect(year?.withdrawals.hsa).toBeCloseTo(60_000 - expectedDraw, 2);
    expect(year?.withdrawals.traditional).toBe(0);
    expect(year?.agi).toBe(0);
  });

  it('keeps unused auto-deplete brokerage proceeds in cash', () => {
    const [year] = runProjection(
      makeScenario({
        balances: {
          cash: 0,
          hsa: 100_000,
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
        autoDepleteBrokerage: {
          enabled: true,
          yearsToDeplete: 10,
          annualScaleUpFactor: 0.02,
          excludeMortgageFromRate: false,
          retirementYear: 2026,
        },
      }),
      makePlan({
        annualSpending: [{ year: 2026, amount: 10_000 }],
      }),
    );

    expect(year?.withdrawals.taxableBrokerage).toBeGreaterThan(40_000);
    expect(year?.withdrawals.hsa).toBe(0);
    expect(year?.closingBalances.cash).toBeGreaterThan(30_000);
  });

  it('starts auto-deplete brokerage at retirement year when the scenario starts earlier', () => {
    const results = runProjection(
      makeScenario({
        startYear: 2026,
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
        autoDepleteBrokerage: {
          enabled: true,
          yearsToDeplete: 10,
          annualScaleUpFactor: 0.02,
          excludeMortgageFromRate: false,
          retirementYear: 2028,
        },
      }),
      makePlan({ endYear: 2028 }),
    );

    expect(results.map((year) => year.withdrawals.taxableBrokerage)).toEqual([0, 0, expect.any(Number)]);
    expect(results[2]?.withdrawals.taxableBrokerage).toBeGreaterThan(0);
  });

  it('depletes brokerage near zero around the tenth auto-deplete year', () => {
    const results = runProjection(
      makeScenario({
        startYear: 2026,
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
        autoDepleteBrokerage: {
          enabled: true,
          yearsToDeplete: 10,
          annualScaleUpFactor: 0.02,
          excludeMortgageFromRate: false,
          retirementYear: 2026,
        },
      }),
      makePlan({ endYear: 2035 }),
    );

    expect(results).toHaveLength(10);
    expect(results[0]?.withdrawals.taxableBrokerage).toBeGreaterThan(0);
    expect(results[0]?.warnings).toEqual([]);
    expect(results[9]?.closingBalances.taxableBrokerage).toBeLessThan(1);
  });

  it('adds generated qualified dividends to the static qualified-dividend schedule', () => {
    const [year] = runProjection(
      makeScenario({
        w2Income: [{ year: 2026, amount: 80_000 }],
        qualifiedDividends: [{ year: 2026, amount: 1_000 }],
        balances: {
          cash: 0,
          hsa: 0,
          taxableBrokerage: 100_000,
          traditional: 0,
          roth: 0,
        },
        basis: {
          taxableBrokerage: 100_000,
        },
        brokerageDividends: {
          annualYield: 0.02,
          qdiPercentage: 0.5,
        },
      }),
      makePlan(),
    );

    expect(year?.brokerageDividends).toMatchObject({
      ordinary: 1_000,
      qualified: 1_000,
      total: 2_000,
    });
    expect(year?.agi).toBe(83_000);
    expect(year?.ltcgTax).toBe(300);
  });

  it.each([
    ['AGI', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.agi],
    ['ACA MAGI', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.acaMagi],
    ['IRMAA MAGI', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.irmaaMagi],
    ['taxable Social Security', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.taxableSocialSecurity],
    ['federal tax', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.federalTax],
    ['state tax', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.stateTax],
    ['LTCG tax', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.ltcgTax],
    ['NIIT', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.niit],
    ['SE tax', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.seTax],
    ['QBI deduction', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.qbiDeduction],
    ['total tax', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.totalTax],
    ['brokerage realized gain', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.brokerageBasis.realizedGainOrLoss],
    ['brokerage basis sold', (year: NonNullable<ReturnType<typeof runProjection>[number]>) => year.brokerageBasis.sold],
  ])('keeps qualified HSA withdrawals out of %s', (_label, getValue) => {
    const hsaScenario = makeScenario({
      consultingIncome: [{ year: 2026, amount: 10_000, sstb: false }],
      socialSecurity: { claimYear: 2026, annualBenefit: 18_000 },
      state: { incomeTaxLaw: PENNSYLVANIA_STATE_TAX },
      taxableInterest: [{ year: 2026, amount: 20_000 }],
    });
    const [baselineYear] = runProjection(hsaScenario, makePlan());
    const [hsaWithdrawalYear] = runProjection(
      {
        ...hsaScenario,
        balances: {
          ...hsaScenario.balances,
          hsa: 100_000,
        },
      },
      makePlan({
        annualSpending: [{ year: 2026, amount: 100_000 }],
      }),
    );

    expect(hsaWithdrawalYear?.withdrawals.hsa).toBeGreaterThan(0);
    expect(getValue(hsaWithdrawalYear!)).toBe(getValue(baselineYear!));
  });

  it('appends annual IRMAA MAGI so later Medicare years use lagged projection history', () => {
    const results = runProjection(
      makeScenario({
        startYear: 2026,
        w2Income: [{ year: 2026, amount: 500_000 }],
        healthcare: [{ year: 2028, kind: 'medicare' }],
      }),
      makePlan({ endYear: 2028 }),
    );

    expect(results[2]?.irmaaPremium).toMatchObject({
      tier: 5,
      magiUsed: 500_000,
      magiSourceYear: 2026,
      annualIrmaaSurcharge: 6_936,
    });
  });

  it('funds Medicare IRMAA surcharges as modeled cash outflows', () => {
    const [year] = runProjection(
      makeScenario({
        startYear: 2028,
        healthcare: [{ year: 2028, kind: 'medicare' }],
        magiHistory: [{ year: 2026, magi: 500_000 }],
        balances: {
          cash: 50_000,
          hsa: 0,
          taxableBrokerage: 0,
          traditional: 0,
          roth: 0,
        },
      }),
      makePlan({ endYear: 2028 }),
    );

    expect(year?.irmaaPremium?.annualIrmaaSurcharge).toBe(6_936);
    expect(year?.withdrawals.cash).toBe(6_936);
    expect(year?.afterTaxCashFlow).toBe(0);
    expect(year?.closingBalances.cash).toBe(43_064);
  });

  it('uses indexed ordinary brackets inside projection years after 2026', () => {
    const [year] = runProjection(
      makeScenario({
        startYear: 2027,
        inflationRate: 0.1,
        w2Income: [{ year: 2027, amount: 28_624 }],
      }),
      makePlan({ endYear: 2027 }),
    );

    expect(year?.agi).toBe(28_624);
    expect(year?.federalTax).toBe(1_252.4);
  });

  it('uses indexed LTCG thresholds inside projection years after 2026', () => {
    const [year] = runProjection(
      makeScenario({
        startYear: 2027,
        inflationRate: 0.1,
        qualifiedDividends: [{ year: 2027, amount: 66_100 }],
      }),
      makePlan({ endYear: 2027 }),
    );

    expect(year?.agi).toBe(66_100);
    expect(year?.ltcgTax).toBe(0);
    expect(year?.federalTax).toBe(0);
  });

  it('uses indexed QBI phaseout thresholds inside projection years after 2026', () => {
    const [year] = runProjection(
      makeScenario({
        startYear: 2027,
        inflationRate: 0.2,
        consultingIncome: [{ year: 2027, amount: 235_000, sstb: false }],
      }),
      makePlan({ endYear: 2027 }),
    );

    expect(year?.qbiDeduction).toBeGreaterThan(40_000);
  });
});
