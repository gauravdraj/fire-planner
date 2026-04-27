import { describe, expect, it } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import { computeFederalTax, computeTaxableIncome } from '@/core/tax/federal';
import { computeLtcgTax } from '@/core/tax/ltcg';
import { computeAgi } from '@/core/tax/magi';
import { computeNiit } from '@/core/tax/niit';
import { computeQbi } from '@/core/tax/qbi';
import { computeSeTax } from '@/core/tax/seTax';
import { computeTaxableSocialSecurity } from '@/core/tax/socialSecurity';
import type { FilingStatus } from '@/core/types';

type SingleYearScenario = {
  filingStatus: FilingStatus;
  grossW2Wages?: number;
  pretaxW2Reduction?: number;
  taxableInterest?: number;
  qualifiedDividends?: number;
  longTermCapitalGains?: number;
  scheduleCNetIncome?: number;
  scheduleCSstb?: boolean;
  grossSocialSecurityBenefits?: number;
  iraDistributions?: number;
  rentalNetIncome?: number;
  taxExemptInterest?: number;
  age65Plus?: boolean;
  partnerAge65Plus?: boolean;
};

type SingleYearEstimate = {
  agi: number;
  taxableIncome: number;
  ordinaryFederalTax: number;
  ltcgTax: number;
  selfEmploymentTax: number;
  qbiDeduction: number;
  niit: number;
  taxableSocialSecurity: number;
  totalFederalLiability: number;
};

// Test-only composition for Gate 1 integration coverage. Production orchestration
// belongs to a later gate; these hand-entered scenarios do not replace fixtures.
function computeTestOnlySingleYearEstimate(input: SingleYearScenario): SingleYearEstimate {
  const taxableWages = nonnegative(input.grossW2Wages) - nonnegative(input.pretaxW2Reduction);
  const taxableInterest = valueOrZero(input.taxableInterest);
  const preferentialIncome = valueOrZero(input.qualifiedDividends) + valueOrZero(input.longTermCapitalGains);
  const scheduleCNetIncome = valueOrZero(input.scheduleCNetIncome);
  const rentalNetIncome = valueOrZero(input.rentalNetIncome);

  const taxableSocialSecurity = computeTaxableSocialSecurity({
    filingStatus: input.filingStatus,
    grossSocialSecurityBenefits: nonnegative(input.grossSocialSecurityBenefits),
    otherIncomeBeforeSocialSecurity:
      taxableWages +
      scheduleCNetIncome +
      taxableInterest +
      preferentialIncome +
      valueOrZero(input.iraDistributions) +
      rentalNetIncome,
    taxExemptInterest: nonnegative(input.taxExemptInterest),
  }).taxableAmount;

  const seTax = computeSeTax({
    filingStatus: input.filingStatus,
    netSeIncome: scheduleCNetIncome,
    totalMedicareWages: nonnegative(input.grossW2Wages),
    w2WagesSubjectToSs: nonnegative(input.grossW2Wages),
  });

  const agi = computeAgi({
    wages: taxableWages,
    taxableBrokerageIncome: taxableInterest,
    capitalGains: preferentialIncome,
    netSelfEmploymentIncome: scheduleCNetIncome,
    seDeductibleHalf: seTax.deductibleHalf,
    taxableSocialSecurity,
    iraDistributions: valueOrZero(input.iraDistributions),
    rentalNetIncome,
  });
  const taxableIncomeOptions: Parameters<typeof computeTaxableIncome>[2] = { magi: agi };
  if (input.age65Plus !== undefined) {
    taxableIncomeOptions.age65Plus = input.age65Plus;
  }
  if (input.partnerAge65Plus !== undefined) {
    taxableIncomeOptions.partnerAge65Plus = input.partnerAge65Plus;
  }

  const taxableIncomeBeforeQbi = computeTaxableIncome(agi, input.filingStatus, taxableIncomeOptions);
  const qbiDeduction = computeQbi({
    filingStatus: input.filingStatus,
    netCapitalGains: preferentialIncome,
    qbiNetIncome: scheduleCNetIncome,
    sstb: input.scheduleCSstb === true,
    taxableIncomeBeforeQbi,
  });
  const taxableIncome = roundToCents(Math.max(0, taxableIncomeBeforeQbi - qbiDeduction));
  const preferentialTaxableIncome = Math.min(Math.max(0, preferentialIncome), taxableIncome);
  const ordinaryTaxableIncome = roundToCents(Math.max(0, taxableIncome - preferentialTaxableIncome));

  const ordinaryFederalTax = computeFederalTax(
    ordinaryTaxableIncome,
    input.filingStatus,
    CONSTANTS_2026.federal.ordinaryBrackets,
  );
  const ltcgTax = computeLtcgTax({
    filingStatus: input.filingStatus,
    ltcgAndQdiv: preferentialTaxableIncome,
    ordinaryTaxableIncome,
  }).ltcgTax;
  const niit = computeNiit({
    filingStatus: input.filingStatus,
    magiForNiit: agi,
    netInvestmentIncome: taxableInterest + preferentialIncome + rentalNetIncome,
  });

  return {
    agi,
    taxableIncome,
    ordinaryFederalTax,
    ltcgTax,
    selfEmploymentTax: seTax.totalSeTax,
    qbiDeduction,
    niit,
    taxableSocialSecurity,
    totalFederalLiability: roundToCents(ordinaryFederalTax + ltcgTax + seTax.totalSeTax + niit),
  };
}

function valueOrZero(value: number | undefined): number {
  return value ?? 0;
}

function nonnegative(value: number | undefined): number {
  return Math.max(0, valueOrZero(value));
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

describe('test-only single-year estimator composition', () => {
  it('Scenario A: single pre-retiree W-2 income with taxable interest and a 401(k)-style reduction', () => {
    expect(
      computeTestOnlySingleYearEstimate({
        filingStatus: 'single',
        grossW2Wages: 120_000,
        pretaxW2Reduction: 15_000,
        taxableInterest: 1_200,
      }),
    ).toEqual({
      agi: 106_200,
      taxableIncome: 90_100,
      ordinaryFederalTax: 14_534,
      ltcgTax: 0,
      selfEmploymentTax: 0,
      qbiDeduction: 0,
      niit: 0,
      taxableSocialSecurity: 0,
      totalFederalLiability: 14_534,
    });
  });

  it('Scenario B: MFJ early retiree with brokerage income and Schedule C consulting', () => {
    expect(
      computeTestOnlySingleYearEstimate({
        filingStatus: 'mfj',
        taxableInterest: 7_000,
        qualifiedDividends: 15_000,
        longTermCapitalGains: 75_000,
        scheduleCNetIncome: 40_000,
      }),
    ).toEqual({
      agi: 134_174.09,
      taxableIncome: 99_579.27,
      ordinaryFederalTax: 957.93,
      ltcgTax: 101.89,
      selfEmploymentTax: 5_651.82,
      qbiDeduction: 2_394.82,
      niit: 0,
      taxableSocialSecurity: 0,
      totalFederalLiability: 6_711.64,
    });
  });

  it('Scenario C: MFJ retirees with Social Security, IRA distributions, and rental income', () => {
    expect(
      computeTestOnlySingleYearEstimate({
        filingStatus: 'mfj',
        grossSocialSecurityBenefits: 60_000,
        iraDistributions: 70_000,
        rentalNetIncome: 8_000,
        age65Plus: true,
        partnerAge65Plus: true,
      }),
    ).toEqual({
      agi: 129_000,
      taxableIncome: 84_800,
      ordinaryFederalTax: 9_680,
      ltcgTax: 0,
      selfEmploymentTax: 0,
      qbiDeduction: 0,
      niit: 0,
      taxableSocialSecurity: 51_000,
      totalFederalLiability: 9_680,
    });
  });
});
