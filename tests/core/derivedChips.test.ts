import { describe, expect, it } from 'vitest';

import {
  deriveAcaHealthcareChip,
  deriveBrokeragePlusCashChip,
  deriveInputChips,
  type DerivedInputChipInput,
} from '@/core/derivedChips';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import type { AccountBalances, Scenario, YearBreakdown } from '@/core/projection';

type ChipFormValues = DerivedInputChipInput['formValues'];

describe('derived input chips', () => {
  it('derives normal inline chip strings from form, scenario, and projection data', () => {
    const formValues = makeFormValues({
      currentYear: 2026,
      primaryAge: 60,
      retirementYear: 2031,
      planEndAge: 70,
      annualSpendingToday: 80_000,
      socialSecurityClaimAge: 67,
    });
    const scenario = makeScenario({
      inflationRate: 0.03,
      socialSecurity: {
        claimYear: 2033,
        annualBenefit: 30_000,
      },
    });
    const projectionResults = [
      makeBreakdown({
        year: 2026,
        acaPremiumCredit: makeAcaPremiumCredit(2.5),
        closingBalances: makeBalances({ taxableBrokerage: 500_000 }),
      }),
      makeBreakdown({ year: 2031, closingBalances: makeBalances({ taxableBrokerage: 120_000 }) }),
      makeBreakdown({ year: 2032, closingBalances: makeBalances({ cash: 20_000, taxableBrokerage: 50_000 }) }),
      makeBreakdown({ year: 2033, closingBalances: makeBalances({}) }),
      makeBreakdown({ year: 2034, closingBalances: makeBalances({ traditional: 250_000 }) }),
      makeBreakdown({ year: 2035, closingBalances: makeBalances({ traditional: 220_000 }) }),
      makeBreakdown({ year: 2036, closingBalances: makeBalances({ traditional: 190_000 }) }),
    ];

    expect(
      deriveInputChips({
        formValues,
        scenario,
        projectionResults,
      }),
    ).toEqual({
      retirementTarget: 'Age 65 in 5 yrs',
      annualSpending: 'Year 1 $80,000 -> 2036 $107,513',
      brokeragePlusCash: 'Lasts ~3 yrs at 0% growth (through 2033)',
      w2Income: 'Stops in 2031',
      socialSecurity: 'Claims in 2033 at age 67',
      healthcare: 'Subsidy band: 200-400% FPL',
    });
  });

  it('handles same-year retirement, exact ACA band boundaries, and plan-end funding caps', () => {
    const formValues = makeFormValues({
      currentYear: 2026,
      primaryAge: 60,
      retirementYear: 2026,
      planEndAge: 62,
      annualSpendingToday: 50_000,
    });
    const projectionResults = [
      makeBreakdown({ year: 2026, acaPremiumCredit: makeAcaPremiumCredit(1.38), closingBalances: makeBalances({ cash: 10_000 }) }),
      makeBreakdown({ year: 2027, closingBalances: makeBalances({ taxableBrokerage: 5_000 }) }),
      makeBreakdown({ year: 2028, closingBalances: makeBalances({ taxableBrokerage: 1 }) }),
    ];

    expect(
      deriveInputChips({
        formValues,
        scenario: makeScenario({ inflationRate: 0 }),
        projectionResults,
      }),
    ).toMatchObject({
      retirementTarget: 'Age 60 this year',
      annualSpending: 'Year 1 $50,000 -> 2028 $50,000',
      brokeragePlusCash: 'Lasts ~3 yrs at 0% growth (through 2028)',
      healthcare: 'Subsidy band: 138-200% FPL',
    });
  });

  it('handles missing projection results without throwing', () => {
    const chips = deriveInputChips({
      formValues: makeFormValues(),
      scenario: makeScenario({ inflationRate: 0.02 }),
      projectionResults: null,
    });

    expect(chips).toMatchObject({
      annualSpending: 'Year 1 $60,000 -> 2036 $73,140',
      brokeragePlusCash: 'Years funded unavailable',
      healthcare: 'Subsidy band unavailable',
    });
    expect(deriveBrokeragePlusCashChip(makeFormValues(), [])).toBe('Years funded unavailable');
    expect(deriveAcaHealthcareChip(makeFormValues(), makeScenario(), undefined)).toBe('Subsidy band unavailable');
  });

  it('uses past-retirement wording and starts brokerage funding from the current projection year', () => {
    const formValues = makeFormValues({
      currentYear: 2029,
      primaryAge: 63,
      retirementYear: 2026,
      planEndAge: 65,
    });
    const projectionResults = [
      makeBreakdown({ year: 2029, closingBalances: makeBalances({ taxableBrokerage: 12_000 }) }),
      makeBreakdown({ year: 2030, closingBalances: makeBalances({}) }),
      makeBreakdown({ year: 2031, closingBalances: makeBalances({ traditional: 200_000 }) }),
    ];

    expect(
      deriveInputChips({
        formValues,
        scenario: makeScenario(),
        projectionResults,
      }),
    ).toMatchObject({
      retirementTarget: 'Age 60, 3 yrs ago',
      brokeragePlusCash: 'Lasts ~2 yrs at 0% growth (through 2030)',
      w2Income: 'Already retired',
    });
  });
});

function makeFormValues(overrides: Partial<ChipFormValues> = {}): ChipFormValues {
  return {
    currentYear: 2026,
    primaryAge: 60,
    retirementYear: 2028,
    planEndAge: 70,
    annualSpendingToday: 60_000,
    socialSecurityClaimAge: 67,
    ...overrides,
  };
}

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

function makeAcaPremiumCredit(fplPercent: number): NonNullable<YearBreakdown['acaPremiumCredit']> {
  return {
    applicablePercentage: 0.0996,
    fplPercent,
    isEligible: fplPercent <= 4,
    premiumTaxCredit: 0,
    requiredContribution: 0,
  };
}
