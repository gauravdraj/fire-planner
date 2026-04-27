import { CALIFORNIA_STATE_TAX } from '@/core/constants/states/california';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import { PENNSYLVANIA_STATE_TAX } from '@/core/constants/states/pennsylvania';
import type {
  AccountReturns,
  AnnualAmount,
  ConsultingScheduleEntry,
  HealthcarePhase,
  RentalScheduleEntry,
  Scenario,
  W2ScheduleEntry,
  WithdrawalPlan,
} from '@/core/projection';
import type { StateIncomeTaxLaw } from '@/core/tax/state';
import type { FilingStatus, MagiYear } from '@/core/types';

export type BasicStarterStateCode = 'CA' | 'FL' | 'PA';
export type BasicHealthcarePhase = 'none' | 'aca' | 'medicare';

export type BasicFormValues = Readonly<{
  currentYear: number;
  filingStatus: FilingStatus;
  stateCode: BasicStarterStateCode;
  primaryAge: number;
  partnerAge: number;
  retirementYear: number;
  planEndAge: number;
  annualSpendingToday: number;
  annualW2Income: number;
  annualConsultingIncome: number;
  annualRentalIncome: number;
  annualSocialSecurityBenefit: number;
  socialSecurityClaimAge: number;
  annualPensionOrAnnuityIncome: number;
  brokerageAndCashBalance: number;
  taxableBrokerageBasis: number;
  traditionalBalance: number;
  rothBalance: number;
  healthcarePhase: BasicHealthcarePhase;
}>;

export type ProjectionInputs = Readonly<{
  scenario: Scenario;
  plan: WithdrawalPlan;
}>;

export const BASIC_FORM_MAPPING_DEFAULTS = Object.freeze({
  inflationRate: 0.03,
  expectedReturns: Object.freeze({
    cash: 0,
    taxableBrokerage: 0,
    traditional: 0,
    roth: 0,
  } satisfies AccountReturns),
  acaAnnualBenchmarkPremium: 0,
  magiHistory: Object.freeze([] as MagiYear[]),
});

const STATE_LAWS = Object.freeze({
  CA: CALIFORNIA_STATE_TAX,
  FL: FLORIDA_STATE_TAX,
  PA: PENNSYLVANIA_STATE_TAX,
} satisfies Record<BasicStarterStateCode, StateIncomeTaxLaw>);

/**
 * Maps Gate 3's basic form into the current projection engine contract.
 *
 * Policies intentionally pinned here:
 * - currentYear is the projection base year and becomes scenario.startYear.
 * - retirementYear is entered directly; it is not derived from age fields.
 * - plan.endYear = currentYear + (planEndAge - primaryAge).
 * - Social Security claimYear = currentYear + (claimAge - primaryAge).
 * - Primary and MFJ partner ages map only to the engine's current 65-plus tax
 *   flags; the engine does not yet model a per-year age schedule.
 * - spending starts in today's dollars and is inflated annually at the scenario
 *   inflation rate.
 * - W-2 and consulting income run through the year before retirement, then zero.
 * - consulting defaults to non-SSTB with zero W-2 wages and UBIA.
 * - rental income is treated as materially participating because the engine uses
 *   that boolean to classify rental NIIT treatment.
 * - the combined pension/annuity field maps to pension income; annuity stays zero.
 * - brokerage plus cash maps to taxable brokerage; engine cash starts at zero.
 * - taxable basis maps to taxable brokerage basis.
 * - HSA is deliberately absent because the engine has no HSA balance bucket.
 */
export function mapBasicFormToProjectionInputs(values: BasicFormValues): ProjectionInputs {
  const startYear = values.currentYear;
  const endYear = values.currentYear + (values.planEndAge - values.primaryAge);
  const years = buildYearRange(startYear, endYear);
  const socialSecurityClaimYear = values.currentYear + (values.socialSecurityClaimAge - values.primaryAge);
  const inflationRate = BASIC_FORM_MAPPING_DEFAULTS.inflationRate;

  const scenario: Scenario = {
    startYear,
    filingStatus: values.filingStatus,
    w2Income: buildW2Income(values, years),
    consultingIncome: buildConsultingIncome(values, years),
    healthcare: buildHealthcareSchedule(values, years),
    pensionIncome: buildRetirementIncomeSchedule(years, values.retirementYear, values.annualPensionOrAnnuityIncome),
    annuityIncome: buildRetirementIncomeSchedule(years, values.retirementYear, 0),
    rentalIncome: buildRentalIncome(values, years),
    state: {
      incomeTaxLaw: STATE_LAWS[values.stateCode],
    },
    balances: {
      cash: 0,
      taxableBrokerage: values.brokerageAndCashBalance,
      traditional: values.traditionalBalance,
      roth: values.rothBalance,
    },
    basis: {
      taxableBrokerage: values.taxableBrokerageBasis,
    },
    inflationRate,
    expectedReturns: BASIC_FORM_MAPPING_DEFAULTS.expectedReturns,
    magiHistory: BASIC_FORM_MAPPING_DEFAULTS.magiHistory,
    age65Plus: values.primaryAge >= 65,
    ...(values.filingStatus === 'mfj' ? { partnerAge65Plus: values.partnerAge >= 65 } : {}),
    ...(values.annualSocialSecurityBenefit > 0
      ? {
          socialSecurity: {
            claimYear: socialSecurityClaimYear,
            annualBenefit: values.annualSocialSecurityBenefit,
          },
        }
      : {}),
  };

  return {
    scenario,
    plan: {
      endYear,
      annualSpending: years.map((year) => ({
        year,
        amount: roundToCents(values.annualSpendingToday * (1 + inflationRate) ** (year - startYear)),
      })),
    },
  };
}

function buildYearRange(startYear: number, endYear: number): number[] {
  const years: number[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    years.push(year);
  }

  return years;
}

function buildW2Income(values: BasicFormValues, years: readonly number[]): W2ScheduleEntry[] {
  return years.map((year) => ({
    year,
    amount: year < values.retirementYear ? values.annualW2Income : 0,
  }));
}

function buildConsultingIncome(values: BasicFormValues, years: readonly number[]): ConsultingScheduleEntry[] {
  return years.map((year) => ({
    year,
    amount: year < values.retirementYear ? values.annualConsultingIncome : 0,
    sstb: false,
    w2WagesAggregated: 0,
    ubiaAggregated: 0,
  }));
}

function buildRentalIncome(values: BasicFormValues, years: readonly number[]): RentalScheduleEntry[] {
  return years.map((year) => ({
    year,
    amount: values.annualRentalIncome,
    cashFlow: values.annualRentalIncome,
    materiallyParticipates: true,
  }));
}

function buildRetirementIncomeSchedule(
  years: readonly number[],
  retirementYear: number,
  annualAmount: number,
): AnnualAmount[] {
  return years.map((year) => ({
    year,
    amount: year >= retirementYear ? annualAmount : 0,
  }));
}

function buildHealthcareSchedule(values: BasicFormValues, years: readonly number[]): HealthcarePhase[] {
  return years.map((year) => buildHealthcarePhase(values, year));
}

function buildHealthcarePhase(values: BasicFormValues, year: number): HealthcarePhase {
  if (values.healthcarePhase === 'aca') {
    return {
      year,
      kind: 'aca',
      householdSize: defaultAcaHouseholdSize(values.filingStatus),
      annualBenchmarkPremium: BASIC_FORM_MAPPING_DEFAULTS.acaAnnualBenchmarkPremium,
    };
  }

  return {
    year,
    kind: values.healthcarePhase,
  };
}

function defaultAcaHouseholdSize(filingStatus: FilingStatus): number {
  return filingStatus === 'mfj' ? 2 : 1;
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}
