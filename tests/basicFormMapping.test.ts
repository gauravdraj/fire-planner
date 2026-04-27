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
      annualW2Income: 190_000,
      annualConsultingIncome: 15_000,
      annualRentalIncome: 12_000,
      annualSocialSecurityBenefit: 48_000,
      socialSecurityClaimAge: 67,
      annualPensionOrAnnuityIncome: 20_000,
      brokerageAndCashBalance: 500_000,
      taxableBrokerageBasis: 300_000,
      traditionalBalance: 800_000,
      rothBalance: 150_000,
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
      taxableBrokerage: 500_000,
      traditional: 800_000,
      roth: 150_000,
    });
    expect(scenario.balances).not.toHaveProperty('hsa');
    expect(scenario.basis.taxableBrokerage).toBe(300_000);

    expect(entryForYear(scenario.healthcare, 2026)).toMatchObject({
      kind: 'aca',
      householdSize: 2,
      annualBenchmarkPremium: 0,
    });

    // Defaults for non-form values stay visible and boring until Gate 4 exposes controls.
    expect(scenario.inflationRate).toBe(BASIC_FORM_MAPPING_DEFAULTS.inflationRate);
    expect(scenario.expectedReturns).toEqual(BASIC_FORM_MAPPING_DEFAULTS.expectedReturns);
    expect(scenario.magiHistory).toEqual(BASIC_FORM_MAPPING_DEFAULTS.magiHistory);

    const results = runProjection(scenario, plan);

    expect(results).toHaveLength(8);
    expect(results.map((year) => year.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]);
    expect(results[0]?.openingBalances).not.toHaveProperty('hsa');
    expect(results.at(-1)?.closingBalances).not.toHaveProperty('hsa');
  });
});
