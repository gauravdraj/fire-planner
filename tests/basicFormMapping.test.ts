import { describe, expect, it } from 'vitest';

import { runProjection } from '@/core/projection';
import { BASIC_FORM_MAPPING_DEFAULTS, mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';

function entryForYear<TEntry extends { year: number }>(entries: readonly TEntry[], year: number): TEntry {
  const entry = entries.find((candidate) => candidate.year === year);

  if (entry === undefined) {
    throw new Error(`Expected entry for ${year}`);
  }

  return entry;
}

describe('basic form projection mapping', () => {
  it('maps a realistic MFJ basic form into valid projection inputs', () => {
    const formValues: BasicFormValues = {
      currentYear: 2026,
      filingStatus: 'mfj',
      stateCode: 'CA',
      primaryAge: 60,
      partnerAge: 65,
      retirementYear: 2028,
      planEndAge: 67,
      annualSpendingToday: 100_000,
      annualMortgagePAndI: 18_000,
      mortgagePayoffYear: 2030,
      annualW2Income: 190_000,
      annualConsultingIncome: 15_000,
      annualRentalIncome: 12_000,
      annualSocialSecurityBenefit: 48_000,
      socialSecurityClaimAge: 67,
      annualPensionOrAnnuityIncome: 20_000,
      brokerageAndCashBalance: 500_000,
      taxableBrokerageBasis: 300_000,
      hsaBalance: 25_000,
      traditionalBalance: 800_000,
      rothBalance: 150_000,
      autoDepleteBrokerageEnabled: true,
      autoDepleteBrokerageYears: 10,
      autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
      expectedReturnTraditional: 0.05,
      expectedReturnRoth: 0.04,
      expectedReturnBrokerage: 0.03,
      expectedReturnHsa: 0.02,
      brokerageDividendYield: 0.02,
      brokerageQdiPercentage: 0.95,
      healthcarePhase: 'aca',
    };

    const { scenario, plan } = mapBasicFormToProjectionInputs(formValues);

    expect(scenario.startYear).toBe(2026);
    expect(plan.endYear).toBe(2033);
    expect(plan).not.toHaveProperty('rothConversions');
    expect(plan).not.toHaveProperty('brokerageHarvests');
    expect(scenario.filingStatus).toBe('mfj');
    expect(scenario.state.incomeTaxLaw.stateCode).toBe('CA');
    expect(scenario.age65Plus).toBe(false);
    expect(scenario.partnerAge65Plus).toBe(true);

    expect(entryForYear(plan.annualSpending, 2026).amount).toBe(100_000);
    expect(entryForYear(plan.annualSpending, 2028).amount).toBe(106_090);
    expect(entryForYear(plan.annualSpending, 2033).amount).toBeCloseTo(122_987.39, 2);
    expect(scenario.mortgage).toEqual({ annualPI: 18_000, payoffYear: 2030 });

    expect(entryForYear(scenario.w2Income, 2027).amount).toBe(190_000);
    expect(entryForYear(scenario.w2Income, 2028).amount).toBe(0);
    expect(entryForYear(scenario.w2Income, 2033).amount).toBe(0);

    expect(entryForYear(scenario.consultingIncome, 2026)).toMatchObject({
      amount: 15_000,
      sstb: false,
      w2WagesAggregated: 0,
      ubiaAggregated: 0,
    });
    expect(entryForYear(scenario.consultingIncome, 2028).amount).toBe(0);

    expect(scenario.socialSecurity).toMatchObject({
      claimYear: 2033,
      annualBenefit: 48_000,
    });

    expect(entryForYear(scenario.rentalIncome, 2026)).toMatchObject({
      amount: 12_000,
      cashFlow: 12_000,
      materiallyParticipates: true,
    });
    expect(entryForYear(scenario.pensionIncome, 2027).amount).toBe(0);
    expect(entryForYear(scenario.pensionIncome, 2028).amount).toBe(20_000);
    expect(entryForYear(scenario.annuityIncome, 2028).amount).toBe(0);

    expect(scenario.balances).toEqual({
      cash: 0,
      hsa: 25_000,
      taxableBrokerage: 500_000,
      traditional: 800_000,
      roth: 150_000,
    });
    expect(scenario.basis.taxableBrokerage).toBe(300_000);
    expect(scenario.expectedReturns).toEqual({
      cash: 0,
      hsa: 0.02,
      taxableBrokerage: 0.03,
      traditional: 0.05,
      roth: 0.04,
    });
    expect(scenario.brokerageDividends).toEqual({ annualYield: 0.02, qdiPercentage: 0.95 });
    expect(scenario.autoDepleteBrokerage).toEqual({
      enabled: true,
      yearsToDeplete: 10,
      annualScaleUpFactor: 0.02,
      excludeMortgageFromRate: false,
      retirementYear: 2028,
    });

    expect(entryForYear(scenario.healthcare, 2026)).toMatchObject({
      kind: 'aca',
      householdSize: 2,
      annualBenchmarkPremium: 0,
    });

    // Defaults for non-form values stay visible and boring until Gate 4 exposes controls.
    expect(scenario.inflationRate).toBe(BASIC_FORM_MAPPING_DEFAULTS.inflationRate);
    expect(formValues.brokerageQdiPercentage).toBe(BASIC_FORM_MAPPING_DEFAULTS.brokerageQdiPercentage);
    expect(scenario.magiHistory).toEqual(BASIC_FORM_MAPPING_DEFAULTS.magiHistory);

    const results = runProjection(scenario, plan);

    expect(results).toHaveLength(8);
    expect(results.map((year) => year.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]);
    expect(results[0]?.spending).toBe(118_000);
    expect(results[4]?.spending).toBeCloseTo(112_550.88 + 18_000, 2);
    expect(results[5]?.spending).toBeCloseTo(115_927.41, 2);
    expect(results[0]?.openingBalances.hsa).toBe(25_000);
    expect(results.at(-1)?.closingBalances.hsa).toBeGreaterThanOrEqual(0);
  });

  it('applies the visible traditional expected return to projection growth', () => {
    const formValues: BasicFormValues = {
      currentYear: 2026,
      filingStatus: 'single',
      stateCode: 'FL',
      primaryAge: 60,
      partnerAge: 60,
      retirementYear: 2027,
      planEndAge: 60,
      annualSpendingToday: 0,
      annualMortgagePAndI: 0,
      mortgagePayoffYear: 0,
      annualW2Income: 0,
      annualConsultingIncome: 0,
      annualRentalIncome: 0,
      annualSocialSecurityBenefit: 0,
      socialSecurityClaimAge: 67,
      annualPensionOrAnnuityIncome: 0,
      brokerageAndCashBalance: 0,
      taxableBrokerageBasis: 0,
      hsaBalance: 0,
      traditionalBalance: 1_000_000,
      rothBalance: 0,
      autoDepleteBrokerageEnabled: false,
      autoDepleteBrokerageYears: 10,
      autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
      expectedReturnTraditional: 0.05,
      expectedReturnRoth: 0,
      expectedReturnBrokerage: 0,
      expectedReturnHsa: 0,
      brokerageDividendYield: 0,
      brokerageQdiPercentage: 0.95,
      healthcarePhase: 'none',
    };
    const { scenario, plan } = mapBasicFormToProjectionInputs(formValues);

    const [year] = runProjection(scenario, plan);

    expect(scenario.expectedReturns.traditional).toBe(0.05);
    expect(scenario.expectedReturns.cash).toBe(0);
    expect(year?.closingBalances.traditional).toBeCloseTo(1_050_000, 2);
  });
});
