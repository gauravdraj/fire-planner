import { describe, expect, it } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
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
      taxableBrokerage: 100_000,
      traditional: 40_000,
      roth: 10_000,
    });
    expect(year?.ltcgTax).toBe(0);
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
