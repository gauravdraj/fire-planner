import { describe, expect, it } from 'vitest';

import {
  computeAverageBridgeAcaMagi,
  computeBridgeAcaCliffYearCount,
  computeBridgeIrmaaTouchedYearCount,
  computeFederalBracketProximity,
  computeFplBand,
  computeFplPercentage,
  computeMaxBridgeGrossBucketDrawPercentage,
  computeNetWorthAtRetirement,
  computePlanEndBalance,
  computeTotalBridgeTax,
  computeWithdrawalRate,
  computeWithdrawalRateBand,
  computeWithdrawalRateBandForYear,
  computeYearDisplayMetrics,
  computeYearsFundedFromRetirement,
  pAndIBeforePayoff,
  pickFplHouseholdSize,
  selectBridgeWindow,
  summarizeProjectionRunChanges,
  summarizeYearOverYearChanges,
  type ProjectionMetricFormValues,
} from '@/core/metrics';
import { CONSTANTS_2026 } from '@/core/constants/2026';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import type { AccountBalances, Scenario, YearBreakdown } from '@/core/projection';

describe('projection metric helpers', () => {
  it('computes balance metrics from retirement and plan-end projection rows', () => {
    const projectionResults = [
      makeBreakdown({
        year: 2026,
        openingBalances: makeBalances({ taxableBrokerage: 25_000 }),
        closingBalances: makeBalances({ taxableBrokerage: 25_000 }),
      }),
      makeBreakdown({
        year: 2027,
        openingBalances: makeBalances({ cash: 5_000, taxableBrokerage: 75_000, traditional: 20_000 }),
        closingBalances: makeBalances({ taxableBrokerage: 60_000 }),
      }),
      makeBreakdown({
        year: 2028,
        openingBalances: makeBalances({ taxableBrokerage: 60_000 }),
        closingBalances: makeBalances({}),
      }),
      makeBreakdown({
        year: 2029,
        openingBalances: makeBalances({}),
        closingBalances: makeBalances({ cash: 1_000, roth: 4_000 }),
      }),
    ];

    expect(computeNetWorthAtRetirement(projectionResults, 2027)).toEqual({
      amount: 100_000,
      year: 2027,
    });
    expect(computePlanEndBalance(projectionResults)).toEqual({
      amount: 5_000,
      year: 2029,
    });
  });

  it('counts consecutive funded years from retirement until supported balances hit zero', () => {
    const projectionResults = [
      makeBreakdown({ year: 2026, closingBalances: makeBalances({ taxableBrokerage: 50_000 }) }),
      makeBreakdown({ year: 2027, closingBalances: makeBalances({ taxableBrokerage: 25_000 }) }),
      makeBreakdown({ year: 2028, closingBalances: makeBalances({}) }),
      makeBreakdown({ year: 2029, closingBalances: makeBalances({ taxableBrokerage: 10_000 }) }),
    ];

    expect(computeYearsFundedFromRetirement(projectionResults, 2027)).toEqual({
      count: 2,
      depletedYear: 2028,
      fundedThroughYear: 2028,
    });
  });

  it('counts through plan end when balances never run out after retirement', () => {
    const projectionResults = [
      makeBreakdown({ year: 2026, closingBalances: makeBalances({ taxableBrokerage: 50_000 }) }),
      makeBreakdown({ year: 2027, closingBalances: makeBalances({ taxableBrokerage: 40_000 }) }),
      makeBreakdown({ year: 2028, closingBalances: makeBalances({ taxableBrokerage: 30_000 }) }),
      makeBreakdown({ year: 2029, closingBalances: makeBalances({ taxableBrokerage: 20_000 }) }),
    ];

    expect(computeYearsFundedFromRetirement(projectionResults, 2027)).toEqual({
      count: 3,
      depletedYear: null,
      fundedThroughYear: 2029,
    });
  });

  it('selects the Medicare bridge window first and computes bridge aggregates from existing fields', () => {
    const projectionResults = [
      makeBreakdown({ year: 2027 }),
      makeBreakdown({
        year: 2028,
        acaMagi: 10_000,
        openingBalances: makeBalances({ taxableBrokerage: 100_000 }),
        withdrawals: makeBalances({ taxableBrokerage: 5_000 }),
        totalTax: 100.1,
      }),
      makeBreakdown({
        year: 2029,
        acaMagi: 20_000,
        openingBalances: makeBalances({ taxableBrokerage: 100_000 }),
        withdrawals: makeBalances({ traditional: 10_000 }),
        totalTax: 200.2,
      }),
      makeBreakdown({
        year: 2030,
        acaMagi: 30_000,
        openingBalances: makeBalances({ taxableBrokerage: 50_000 }),
        withdrawals: makeBalances({ roth: 10_000 }),
        totalTax: 300.3,
      }),
      makeBreakdown({ year: 2031, acaMagi: 40_000, totalTax: 400.4 }),
    ];
    const window = selectBridgeWindow(
      makeFormValues({
        currentYear: 2026,
        primaryAge: 60,
        retirementYear: 2028,
        annualSocialSecurityBenefit: 20_000,
        socialSecurityClaimAge: 62,
      }),
      projectionResults,
    );

    expect(window.reason).toBe('medicare');
    expect(window.startYear).toBe(2028);
    expect(window.endYear).toBe(2030);
    expect(window.years.map((breakdown) => breakdown.year)).toEqual([2028, 2029, 2030]);
    expect(computeAverageBridgeAcaMagi(window.years)).toBe(20_000);
    expect(computeMaxBridgeGrossBucketDrawPercentage(window.years)).toBe(0.2);
    expect(computeTotalBridgeTax(window.years)).toBe(600.6);
  });

  it('counts bridge years above the ACA 400% FPL cliff using ACA household size', () => {
    const scenario = makeScenario({
      filingStatus: 'single',
      healthcare: [
        { year: 2027, kind: 'aca', householdSize: 2, annualBenchmarkPremium: 12_000 },
        { year: 2028, kind: 'aca', householdSize: 2, annualBenchmarkPremium: 12_000 },
      ],
    });
    const bridgeYears = [
      makeBreakdown({
        year: 2027,
        acaMagi: CONSTANTS_2026.fpl.contiguous.householdSize[2] * 4,
      }),
      makeBreakdown({
        year: 2028,
        acaMagi: CONSTANTS_2026.fpl.contiguous.householdSize[2] * 4.01,
      }),
    ];

    expect(computeBridgeAcaCliffYearCount(bridgeYears, scenario)).toBe(1);
  });

  it('counts single-filer bridge years above the ACA cliff from filing-status household size', () => {
    const scenario = makeScenario({ filingStatus: 'single' });
    const bridgeYears = [
      makeBreakdown({
        year: 2027,
        acaMagi: CONSTANTS_2026.fpl.contiguous.householdSize[1] * 3.99,
      }),
      makeBreakdown({
        year: 2028,
        acaMagi: CONSTANTS_2026.fpl.contiguous.householdSize[1] * 4.25,
      }),
    ];

    expect(computeBridgeAcaCliffYearCount(bridgeYears, scenario)).toBe(1);
  });

  it('returns zero ACA cliff years when bridge MAGI stays at or below 400% FPL', () => {
    const scenario = makeScenario({ filingStatus: 'mfj' });
    const bridgeYears = [
      makeBreakdown({
        year: 2027,
        acaMagi: CONSTANTS_2026.fpl.contiguous.householdSize[2] * 2.5,
      }),
      makeBreakdown({
        year: 2028,
        acaMagi: CONSTANTS_2026.fpl.contiguous.householdSize[2] * 4,
      }),
    ];

    expect(computeBridgeAcaCliffYearCount(bridgeYears, scenario)).toBe(0);
  });

  it('counts bridge years where IRMAA premiums exceed the standard Part B premium', () => {
    const bridgeYears = [
      makeBreakdown({ year: 2027, irmaaPremium: null }),
      makeBreakdown({ year: 2028, irmaaPremium: makeIrmaaPremium(0) }),
      makeBreakdown({ year: 2029, irmaaPremium: makeIrmaaPremium(1) }),
    ];

    expect(computeBridgeIrmaaTouchedYearCount(bridgeYears)).toBe(1);
  });

  it('returns zero IRMAA-touched years when premiums do not exceed the standard premium', () => {
    const bridgeYears = [
      makeBreakdown({ year: 2027, irmaaPremium: null }),
      makeBreakdown({ year: 2028, irmaaPremium: makeIrmaaPremium(0) }),
    ];

    expect(computeBridgeIrmaaTouchedYearCount(bridgeYears)).toBe(0);
  });

  it('selects the Social Security bridge window when Medicare is not applicable', () => {
    const projectionResults = [2027, 2028, 2029, 2030].map((year) => makeBreakdown({ year }));
    const window = selectBridgeWindow(
      makeFormValues({
        currentYear: 2026,
        primaryAge: 66,
        retirementYear: 2027,
        annualSocialSecurityBenefit: 20_000,
        socialSecurityClaimAge: 70,
      }),
      projectionResults,
    );

    expect(window.reason).toBe('socialSecurity');
    expect(window.startYear).toBe(2027);
    expect(window.endYear).toBe(2029);
    expect(window.years.map((breakdown) => breakdown.year)).toEqual([2027, 2028, 2029]);
  });

  it('falls back to ten retirement years when neither Medicare nor Social Security applies', () => {
    const projectionResults = Array.from({ length: 11 }, (_, index) => makeBreakdown({ year: 2027 + index }));
    const window = selectBridgeWindow(
      makeFormValues({
        currentYear: 2026,
        primaryAge: 66,
        retirementYear: 2027,
        annualSocialSecurityBenefit: 0,
        socialSecurityClaimAge: 70,
      }),
      projectionResults,
    );

    expect(window.reason).toBe('tenYearFallback');
    expect(window.startYear).toBe(2027);
    expect(window.endYear).toBe(2036);
    expect(window.years.map((breakdown) => breakdown.year)).toEqual([
      2027,
      2028,
      2029,
      2030,
      2031,
      2032,
      2033,
      2034,
      2035,
      2036,
    ]);
  });

  it('computes FPL percentages with encoded household-size and additional-person rules', () => {
    expect(computeFplPercentage(CONSTANTS_2026.fpl.contiguous.householdSize[1] * 1.5, 1)).toBe(1.5);
    expect(computeFplPercentage(CONSTANTS_2026.fpl.contiguous.householdSize[8] * 2, 8)).toBe(2);
    expect(computeFplPercentage(61_400, 9)).toBe(1);
  });

  it('picks filing-status household sizes for non-ACA FPL display', () => {
    expect(pickFplHouseholdSize('mfj')).toBe(2);
    expect(pickFplHouseholdSize('single')).toBe(1);
    expect(pickFplHouseholdSize('hoh')).toBe(1);
    expect(pickFplHouseholdSize('mfs')).toBe(1);
  });

  it('classifies representative FPL bands and exact cliff boundaries', () => {
    expect(computeFplBand(1)).toBe('below-aca');
    expect(computeFplBand(1.3799)).toBe('below-aca');
    expect(computeFplBand(1.38)).toBe('aca-low');
    expect(computeFplBand(1.75)).toBe('aca-low');
    expect(computeFplBand(2)).toBe('aca-mid');
    expect(computeFplBand(2.5)).toBe('aca-mid');
    expect(computeFplBand(3)).toBe('aca-high');
    expect(computeFplBand(4)).toBe('aca-high');
    expect(computeFplBand(4.0001)).toBe('above-cliff');
  });

  it('computes withdrawal rates from prior closing balances and excludes conversions', () => {
    const priorYear = makeBreakdown({ closingBalances: makeBalances({ taxableBrokerage: 100_000 }) });
    const currentYear = makeBreakdown({
      conversions: 20_000,
      withdrawals: makeBalances({ cash: 1_000, taxableBrokerage: 4_000 }),
    });

    expect(computeWithdrawalRate(currentYear, null)).toBeNull();
    expect(computeWithdrawalRate(currentYear, makeBreakdown({ closingBalances: makeBalances({}) }))).toBeNull();
    expect(computeWithdrawalRate(currentYear, priorYear)).toBe(0.05);
  });

  it('excludes qualified HSA withdrawals from the withdrawal rate numerator', () => {
    const priorYear = makeBreakdown({ closingBalances: makeBalances({ taxableBrokerage: 100_000 }) });
    const currentYear = makeBreakdown({
      withdrawals: makeBalances({ hsa: 12_000, taxableBrokerage: 4_000 }),
    });

    expect(computeWithdrawalRate(currentYear, priorYear)).toBe(0.04);
  });

  it('can exclude mortgage P&I from the withdrawal rate numerator', () => {
    const priorYear = makeBreakdown({ closingBalances: makeBalances({ taxableBrokerage: 100_000 }) });
    const currentYear = makeBreakdown({
      year: 2027,
      withdrawals: makeBalances({ taxableBrokerage: 52_000 }),
    });
    const baseScenario = makeScenario({
      mortgage: {
        annualPI: 12_000,
        payoffYear: 2030,
      },
    });
    const includedMortgageScenario = makeScenario({
      ...baseScenario,
      autoDepleteBrokerage: {
        enabled: true,
        yearsToDeplete: 10,
        annualScaleUpFactor: 0,
        excludeMortgageFromRate: false,
      },
    });
    const excludedMortgageScenario = makeScenario({
      ...baseScenario,
      autoDepleteBrokerage: {
        enabled: true,
        yearsToDeplete: 10,
        annualScaleUpFactor: 0,
        excludeMortgageFromRate: true,
      },
    });

    expect(computeWithdrawalRate(currentYear, priorYear, includedMortgageScenario)).toBe(0.52);
    expect(computeWithdrawalRate(currentYear, priorYear, excludedMortgageScenario)).toBe(0.4);
  });

  it('returns mortgage P&I only through the configured payoff year', () => {
    const scenario = makeScenario({
      mortgage: {
        annualPI: 18_000.126,
        payoffYear: 2028,
      },
    });

    expect(pAndIBeforePayoff(makeScenario(), 2026)).toBe(0);
    expect(pAndIBeforePayoff(scenario, 2026)).toBe(18_000.13);
    expect(pAndIBeforePayoff(scenario, 2028)).toBe(18_000.13);
    expect(pAndIBeforePayoff(scenario, 2029)).toBe(0);
  });

  it('classifies exact withdrawal-rate band boundaries', () => {
    expect(computeWithdrawalRateBand(0.0399)).toBe('safe');
    expect(computeWithdrawalRateBand(0.04)).toBe('caution');
    expect(computeWithdrawalRateBand(0.0499)).toBe('caution');
    expect(computeWithdrawalRateBand(0.05)).toBe('danger');
    expect(computeWithdrawalRateBand(0.1)).toBe('danger');
    expect(computeWithdrawalRateBand(0.1001)).toBe('catastrophic');
  });

  it('classifies the plan-end withdrawal row separately from threshold bands', () => {
    expect(computeWithdrawalRateBandForYear(0.1001, { planEndYear: 2035, year: 2034 })).toBe('catastrophic');
    expect(computeWithdrawalRateBandForYear(0.1001, { planEndYear: 2035, year: 2035 })).toBe('plan-end');
    expect(computeWithdrawalRateBandForYear(0.0399, { planEndYear: 2035, year: 2034 })).toBe('safe');
  });

  it('derives plan-end withdrawal-rate bands from display metric context', () => {
    const priorYear = makeBreakdown({ year: 2034, closingBalances: makeBalances({ taxableBrokerage: 100_000 }) });
    const row = makeBreakdown({
      year: 2035,
      withdrawals: makeBalances({ taxableBrokerage: 20_000 }),
    });

    expect(
      computeYearDisplayMetrics(row, {
        formValues: makeFormValues(),
        planEndYear: 2035,
        priorYear,
        scenario: makeScenario(),
      }),
    ).toMatchObject({
      withdrawalRate: 0.2,
      withdrawalRateBand: 'plan-end',
    });
  });

  it('computes federal bracket proximity at exact bracket edges', () => {
    expect(computeFederalBracketProximity(12_399, 'single')).toEqual({
      marginalRate: 0.1,
      nextEdge: 12_400,
      distanceToNextEdge: 1,
    });
    expect(computeFederalBracketProximity(12_400, 'single')).toEqual({
      marginalRate: 0.12,
      nextEdge: 50_400,
      distanceToNextEdge: 38_000,
    });
    expect(computeFederalBracketProximity(640_600, 'single')).toEqual({
      marginalRate: 0.37,
      nextEdge: null,
      distanceToNextEdge: null,
    });
  });

  it('derives display-ready row metrics from a projection row and scenario context', () => {
    const scenario = makeScenario({
      healthcare: [{ year: 2027, kind: 'aca', householdSize: 2, annualBenchmarkPremium: 12_000 }],
      w2Income: [{ year: 2027, amount: 45_000 }],
    });
    const priorYear = makeBreakdown({ year: 2026, closingBalances: makeBalances({ taxableBrokerage: 200_000 }) });
    const row = makeBreakdown({
      year: 2027,
      agi: 100_000,
      irmaaMagi: 100_000,
      qbiDeduction: 5_000,
      acaPremiumCredit: {
        applicablePercentage: 0.0996,
        fplPercent: 4.2,
        isEligible: false,
        premiumTaxCredit: 0,
        requiredContribution: 9_960,
      },
      brokerageBasis: {
        opening: 80_000,
        sold: 10_000,
        realizedGainOrLoss: 12_345,
        closing: 70_000,
      },
      closingBalances: makeBalances({ taxableBrokerage: 180_000, roth: 20_000 }),
      openingBalances: makeBalances({ taxableBrokerage: 210_000 }),
      withdrawals: makeBalances({ taxableBrokerage: 10_000 }),
    });

    expect(
      computeYearDisplayMetrics(row, {
        formValues: makeFormValues({
          currentYear: 2026,
          primaryAge: 64,
          retirementYear: 2027,
          annualSocialSecurityBenefit: 30_000,
          socialSecurityClaimAge: 67,
        }),
        priorYear,
        scenario,
      }),
    ).toMatchObject({
      age: 65,
      phaseLabel: 'Medicare-eligible',
      wages: 45_000,
      taxableIncome: 78_900,
      totalDisplayedIncome: 100_000,
      totalOpeningBalance: 210_000,
      totalClosingBalance: 200_000,
      totalWithdrawals: 10_000,
      fplPercentage: 4.2,
      fplBand: 'above-cliff',
      withdrawalRate: 0.05,
      withdrawalRateBand: 'danger',
      ltcgRealized: 12_345,
    });
  });

  it('falls back to filing status for non-ACA display FPL percentage', () => {
    const scenario = makeScenario({
      filingStatus: 'mfj',
      healthcare: [{ year: 2027, kind: 'medicare' }],
    });
    const row = makeBreakdown({
      year: 2027,
      acaMagi: CONSTANTS_2026.fpl.contiguous.householdSize[2] * 2.5,
    });

    expect(
      computeYearDisplayMetrics(row, {
        formValues: makeFormValues(),
        scenario,
      }),
    ).toMatchObject({
      fplPercentage: 2.5,
      fplBand: 'aca-mid',
    });
  });

  it('prioritizes at most three year-over-year notable changes', () => {
    const scenario = makeScenario({
      healthcare: [
        { year: 2026, kind: 'aca', householdSize: 1, annualBenchmarkPremium: 12_000 },
        { year: 2027, kind: 'aca', householdSize: 1, annualBenchmarkPremium: 12_000 },
      ],
    });
    const projectionResults = [
      makeBreakdown({
        year: 2026,
        agi: 20_000,
        acaPremiumCredit: makeAcaPremiumCredit(3.5),
        brokerageBasis: { opening: 2_000, sold: 1_000, realizedGainOrLoss: 0, closing: 1_000 },
        closingBalances: makeBalances({ taxableBrokerage: 1_000_000 }),
        irmaaPremium: makeIrmaaPremium(0),
      }),
      makeBreakdown({
        year: 2027,
        agi: 80_000,
        acaPremiumCredit: makeAcaPremiumCredit(4.5),
        brokerageBasis: { opening: 1_000, sold: 1_000, realizedGainOrLoss: 0, closing: 0 },
        closingBalances: makeBalances({ taxableBrokerage: 800_000 }),
        irmaaPremium: makeIrmaaPremium(1),
      }),
    ];

    expect(
      summarizeYearOverYearChanges({
        formValues: makeFormValues(),
        projectionResults,
        scenario,
        targetYear: 2027,
      }).map((summary) => summary.kind),
    ).toEqual(['federal-bracket-crossing', 'irmaa-tier-crossing', 'brokerage-basis-depletion']);
  });

  it('compares the same target year across projection runs', () => {
    const scenario = makeScenario();
    const summaries = summarizeProjectionRunChanges({
      currentFormValues: makeFormValues(),
      currentProjectionResults: [
        makeBreakdown({
          year: 2027,
          agi: 80_000,
          closingBalances: makeBalances({ taxableBrokerage: 750_000 }),
        }),
      ],
      currentScenario: scenario,
      previousProjectionResults: [
        makeBreakdown({
          year: 2027,
          agi: 20_000,
          closingBalances: makeBalances({ taxableBrokerage: 1_000_000 }),
        }),
      ],
      targetYear: 2027,
    });

    expect(summaries.map((summary) => summary.kind)).toEqual(['federal-bracket-crossing', 'large-balance-drop']);
  });
});

function makeFormValues(overrides: Partial<ProjectionMetricFormValues> = {}): ProjectionMetricFormValues {
  return {
    currentYear: 2026,
    primaryAge: 60,
    retirementYear: 2028,
    annualSocialSecurityBenefit: 0,
    socialSecurityClaimAge: 67,
    ...overrides,
  };
}

function makeBreakdown(overrides: Partial<YearBreakdown> = {}): YearBreakdown {
  return {
    year: 2026,
    spending: 0,
    openingBalances: makeBalances({}),
    withdrawals: makeBalances({}),
    conversions: 0,
    brokerageHarvests: 0,
    gainsOrLosses: makeBalances({}),
    brokerageBasis: {
      opening: 0,
      sold: 0,
      realizedGainOrLoss: 0,
      closing: 0,
    },
    agi: 0,
    acaMagi: 0,
    irmaaMagi: 0,
    federalTax: 0,
    stateTax: 0,
    ltcgTax: 0,
    niit: 0,
    seTax: 0,
    qbiDeduction: 0,
    taxableSocialSecurity: 0,
    acaPremiumCredit: null,
    aptcReconciliation: null,
    irmaaPremium: null,
    totalTax: 0,
    afterTaxCashFlow: 0,
    warnings: [],
    closingBalances: makeBalances({}),
    ...overrides,
  };
}

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
    state: {
      incomeTaxLaw: FLORIDA_STATE_TAX,
    },
    balances: makeBalances({}),
    basis: {
      taxableBrokerage: 0,
    },
    inflationRate: 0,
    expectedReturns: {},
    ...overrides,
  };
}

function makeBalances(overrides: Partial<AccountBalances>): AccountBalances {
  return {
    cash: 0,
    hsa: 0,
    taxableBrokerage: 0,
    traditional: 0,
    roth: 0,
    ...overrides,
  };
}

function makeAcaPremiumCredit(fplPercent: number): NonNullable<YearBreakdown['acaPremiumCredit']> {
  return {
    applicablePercentage: 0.0996,
    fplPercent,
    isEligible: fplPercent <= 4,
    premiumTaxCredit: 0,
    requiredContribution: 0,
  };
}

function makeIrmaaPremium(tier: number): NonNullable<YearBreakdown['irmaaPremium']> {
  return {
    annualIrmaaSurcharge: tier * 1_000,
    annualTotal: 2_434.8 + tier * 1_000,
    magiSourceYear: 2025,
    magiUsed: 100_000 + tier * 50_000,
    partBMonthlyAdjustment: 0,
    partDMonthlyAdjustment: 0,
    standardPartBPremium: 202.9,
    tier,
  };
}
