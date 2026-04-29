import { describe, expect, it } from 'vitest';

import {
  deriveAcaHealthcareChip,
  deriveBrokeragePlusCashChip,
  deriveInputChips,
  type DerivedInputChipInput,
} from '@/core/derivedChips';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import type { AccountBalances, Scenario, YearBreakdown } from '@/core/projection';
import { DEFAULT_BASIC_INFLATION_RATE } from '@/lib/basicFormMapping';

type ChipFormValues = DerivedInputChipInput['formValues'];

describe('derived input chips', () => {
  it('derives normal inline chip strings from form, scenario, and projection data', () => {
    const formValues = makeFormValues({
      currentYear: 2026,
      primaryAge: 60,
      retirementYear: 2031,
      planEndAge: 70,
      annualSpendingToday: 80_000,
      inflationRate: DEFAULT_BASIC_INFLATION_RATE,
      socialSecurityClaimAge: 67,
    });
    const scenario = makeScenario({
      inflationRate: DEFAULT_BASIC_INFLATION_RATE,
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
      annualSpending: 'Year 1 $80,000 -> 2036 $102,407 nominal',
      mortgagePAndI: 'No mortgage modeled',
      brokeragePlusCash: 'Lasts ~3 yrs (through 2033)',
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
      inflationRate: 0,
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
      annualSpending: 'Year 1 $50,000 -> 2028 $50,000 nominal',
      mortgagePAndI: 'No mortgage modeled',
      brokeragePlusCash: 'Lasts ~3 yrs (through 2028)',
      healthcare: 'Subsidy band: 138-200% FPL',
    });
  });

  it('handles missing projection results without throwing', () => {
    const chips = deriveInputChips({
      formValues: makeFormValues({ inflationRate: 0.02 }),
      scenario: makeScenario(),
      projectionResults: null,
    });

    expect(chips).toMatchObject({
      annualSpending: 'Year 1 $60,000 -> 2036 $73,140 nominal',
      mortgagePAndI: 'No mortgage modeled',
      brokeragePlusCash: 'Years funded unavailable',
      healthcare: 'Subsidy band unavailable',
    });
    expect(deriveBrokeragePlusCashChip(makeFormValues(), [])).toBe('Years funded unavailable');
    expect(deriveAcaHealthcareChip(makeFormValues(), makeScenario(), undefined)).toBe('Subsidy band unavailable');
  });

  it('derives annual spending from the live form inflation rate', () => {
    const chips = deriveInputChips({
      formValues: makeFormValues({
        currentYear: 2026,
        primaryAge: 60,
        planEndAge: 62,
        annualSpendingToday: 100_000,
        inflationRate: 0.04,
      }),
      scenario: makeScenario({ inflationRate: 0 }),
      projectionResults: null,
    });

    expect(chips.annualSpending).toBe('Year 1 $100,000 -> 2028 $108,160 nominal');
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
      brokeragePlusCash: 'Lasts ~2 yrs (through 2030)',
      w2Income: 'Already retired',
    });
  });

  it('does not count HSA balance in brokerage-plus-cash years funded', () => {
    const projectionResults = [
      makeBreakdown({ year: 2028, closingBalances: makeBalances({ hsa: 500_000 }) }),
      makeBreakdown({ year: 2029, closingBalances: makeBalances({ hsa: 500_000 }) }),
    ];

    expect(deriveBrokeragePlusCashChip(makeFormValues({ retirementYear: 2028 }), projectionResults)).toBe(
      'Lasts ~1 yr (through 2028)',
    );
  });

  it('previews auto-deplete duration and year-one brokerage draw when enabled', () => {
    expect(
      deriveBrokeragePlusCashChip(
        makeFormValues({
          brokerageAndCashBalance: 400_000,
          autoDepleteBrokerageEnabled: true,
          autoDepleteBrokerageYears: 10,
          autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
          expectedReturnBrokerage: 0.05,
        }),
        [],
      ),
    ).toBe('Auto-depletes over 10 yrs; year-one draw ~$45,416');
  });

  it('derives mortgage P&I chips from form values and payoff helper behavior', () => {
    expect(
      deriveInputChips({
        formValues: makeFormValues({
          annualMortgagePAndI: 24_000,
          mortgagePayoffYear: 2030,
        }),
        scenario: makeScenario({
          mortgage: {
            annualPI: 24_000,
            payoffYear: 2030,
          },
        }),
        projectionResults: [],
      }),
    ).toMatchObject({
      mortgagePAndI: '5 yrs of payments through 2030',
    });

    expect(
      deriveInputChips({
        formValues: makeFormValues({
          currentYear: 2031,
          annualMortgagePAndI: 24_000,
          mortgagePayoffYear: 2030,
        }),
        scenario: makeScenario({
          mortgage: {
            annualPI: 24_000,
            payoffYear: 2030,
          },
        }),
        projectionResults: [],
      }),
    ).toMatchObject({
      mortgagePAndI: 'Paid off in 2030',
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
    inflationRate: 0,
    annualMortgagePAndI: 0,
    mortgagePayoffYear: 0,
    brokerageAndCashBalance: 0,
    autoDepleteBrokerageEnabled: false,
    autoDepleteBrokerageYears: 10,
    autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
    expectedReturnBrokerage: 0.05,
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
