import { describe, expect, it } from 'vitest';

import {
  computeAverageBridgeAcaMagi,
  computeMaxBridgeGrossBucketDrawPercentage,
  computeNetWorthAtRetirement,
  computePlanEndBalance,
  computeTotalBridgeTax,
  computeYearsFundedFromRetirement,
  selectBridgeWindow,
  type ProjectionMetricFormValues,
} from '@/core/metrics';
import type { AccountBalances, YearBreakdown } from '@/core/projection';

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

function makeBalances(overrides: Partial<AccountBalances>): AccountBalances {
  return {
    cash: 0,
    taxableBrokerage: 0,
    traditional: 0,
    roth: 0,
    ...overrides,
  };
}
