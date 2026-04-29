import { computeAutoDepleteSchedule } from './autoDepleteBrokerage';
import type { HealthcarePhase, Scenario, YearBreakdown } from './projection';
import { getFPLForCoverageYear } from './tax/aca';
import { computeFplBand, computeFplPercentage, pAndIBeforePayoff, type FplBand } from './metrics';

type DerivedChipFormValues = Readonly<{
  currentYear: number;
  primaryAge: number;
  retirementYear: number;
  planEndAge: number;
  annualSpendingToday: number;
  inflationRate: number;
  annualMortgagePAndI: number;
  mortgagePayoffYear: number;
  brokerageAndCashBalance: number;
  autoDepleteBrokerageEnabled: boolean;
  autoDepleteBrokerageYears: number;
  autoDepleteBrokerageAnnualScaleUpFactor: number;
  expectedReturnBrokerage: number;
  socialSecurityClaimAge: number;
}>;

export type DerivedInputChips = Readonly<{
  retirementTarget: string;
  annualSpending: string;
  mortgagePAndI: string;
  brokeragePlusCash: string;
  w2Income: string;
  socialSecurity: string;
  healthcare: string;
}>;

export type DerivedInputChipInput = Readonly<{
  formValues: DerivedChipFormValues;
  projectionResults?: readonly YearBreakdown[] | null;
  scenario: Scenario;
}>;

export function deriveInputChips(input: DerivedInputChipInput): DerivedInputChips {
  return {
    retirementTarget: deriveRetirementTargetChip(input.formValues),
    annualSpending: deriveAnnualSpendingChip(input.formValues),
    mortgagePAndI: deriveMortgagePAndIChip(input.formValues, input.scenario),
    brokeragePlusCash: deriveBrokeragePlusCashChip(input.formValues, input.projectionResults),
    w2Income: deriveW2IncomeChip(input.formValues),
    socialSecurity: deriveSocialSecurityChip(input.formValues, input.scenario),
    healthcare: deriveAcaHealthcareChip(input.formValues, input.scenario, input.projectionResults),
  };
}

export function deriveRetirementTargetChip(formValues: DerivedChipFormValues): string {
  const yearsFromNow = formValues.retirementYear - formValues.currentYear;
  const retirementAge = formValues.primaryAge + yearsFromNow;

  if (yearsFromNow < 0) {
    return `Age ${retirementAge}, ${formatYears(Math.abs(yearsFromNow))} ago`;
  }

  if (yearsFromNow === 0) {
    return `Age ${retirementAge} this year`;
  }

  return `Age ${retirementAge} in ${formatYears(yearsFromNow)}`;
}

export function deriveAnnualSpendingChip(formValues: DerivedChipFormValues): string {
  const planEndYear = computePlanEndYear(formValues);
  const planEndSpending =
    formValues.annualSpendingToday * (1 + formValues.inflationRate) ** (planEndYear - formValues.currentYear);

  return `Year 1 ${formatDollars(formValues.annualSpendingToday)} -> ${planEndYear} ${formatDollars(
    planEndSpending,
  )} nominal`;
}

export function deriveMortgagePAndIChip(formValues: DerivedChipFormValues, scenario: Scenario): string {
  if (formValues.annualMortgagePAndI <= 0) {
    return 'No mortgage modeled';
  }

  if (formValues.mortgagePayoffYear <= 0) {
    return 'Set payoff year to model mortgage';
  }

  const currentYearPayment = pAndIBeforePayoff(scenario, formValues.currentYear);
  if (currentYearPayment <= 0) {
    return `Paid off in ${formValues.mortgagePayoffYear}`;
  }

  const remainingYears = formValues.mortgagePayoffYear - formValues.currentYear + 1;

  return `${formatYears(remainingYears)} of payments through ${formValues.mortgagePayoffYear}`;
}

export function deriveBrokeragePlusCashChip(
  formValues: DerivedChipFormValues,
  projectionResults: readonly YearBreakdown[] | null | undefined,
): string {
  if (formValues.autoDepleteBrokerageEnabled && formValues.autoDepleteBrokerageYears > 0) {
    const schedule = computeAutoDepleteSchedule(
      formValues.brokerageAndCashBalance,
      formValues.autoDepleteBrokerageYears,
      formValues.autoDepleteBrokerageAnnualScaleUpFactor,
      formValues.expectedReturnBrokerage,
    );
    const firstWithdrawal = schedule[0] ?? 0;

    return `Auto-depletes over ${formatYears(formValues.autoDepleteBrokerageYears)}; year-one draw ~${formatDollars(
      firstWithdrawal,
    )}`;
  }

  if (projectionResults === null || projectionResults === undefined || projectionResults.length === 0) {
    return 'Years funded unavailable';
  }

  const firstProjectionYear = projectionResults[0]?.year ?? formValues.currentYear;
  const fundingStartYear = Math.max(formValues.retirementYear, formValues.currentYear, firstProjectionYear);
  let expectedYear = fundingStartYear;
  let fundedYears = 0;
  let fundedThroughYear: number | null = null;

  for (const breakdown of projectionResults) {
    if (breakdown.year < fundingStartYear) {
      continue;
    }

    if (breakdown.year !== expectedYear) {
      break;
    }

    fundedYears += 1;
    fundedThroughYear = breakdown.year;

    if (sumBrokerageAndCash(breakdown.closingBalances) <= 0) {
      break;
    }

    expectedYear += 1;
  }

  return fundedThroughYear === null
    ? 'Years funded unavailable'
    : `Lasts ~${formatYears(fundedYears)} (through ${fundedThroughYear})`;
}

export function deriveW2IncomeChip(formValues: DerivedChipFormValues): string {
  return formValues.retirementYear <= formValues.currentYear ? 'Already retired' : `Stops in ${formValues.retirementYear}`;
}

export function deriveSocialSecurityChip(formValues: DerivedChipFormValues, scenario: Scenario): string {
  const claimYear =
    scenario.socialSecurity?.claimYear ?? formValues.currentYear + (formValues.socialSecurityClaimAge - formValues.primaryAge);
  const claimAge = formValues.primaryAge + (claimYear - formValues.currentYear);

  return `Claims in ${claimYear} at age ${claimAge}`;
}

export function deriveAcaHealthcareChip(
  formValues: DerivedChipFormValues,
  scenario: Scenario,
  projectionResults: readonly YearBreakdown[] | null | undefined,
): string {
  const currentBreakdown = projectionResults?.find((breakdown) => breakdown.year === formValues.currentYear) ?? null;
  if (currentBreakdown === null) {
    return 'Subsidy band unavailable';
  }

  const fplPercentage = selectAcaFplPercentage(currentBreakdown, scenario);

  return fplPercentage === null ? 'Subsidy band unavailable' : `Subsidy band: ${formatFplBand(computeFplBand(fplPercentage))}`;
}

function selectAcaFplPercentage(breakdown: YearBreakdown, scenario: Scenario): number | null {
  if (breakdown.acaPremiumCredit !== null) {
    return breakdown.acaPremiumCredit.fplPercent;
  }

  const healthcarePhase = getHealthcarePhase(scenario.healthcare, breakdown.year);
  if (healthcarePhase.kind !== 'aca') {
    return null;
  }

  return computeFplPercentage(breakdown.acaMagi, healthcarePhase.householdSize, {
    fplTable: getFPLForCoverageYear({
      coverageYear: breakdown.year,
      fplIndexingRate: scenario.inflationRate,
    }),
    ...(healthcarePhase.region !== undefined ? { region: healthcarePhase.region } : {}),
  });
}

function getHealthcarePhase(phases: readonly HealthcarePhase[], year: number): HealthcarePhase {
  return phases.find((phase) => phase.year === year) ?? { year, kind: 'none' };
}

function computePlanEndYear(formValues: DerivedChipFormValues): number {
  return formValues.currentYear + (formValues.planEndAge - formValues.primaryAge);
}

function sumBrokerageAndCash(balances: YearBreakdown['closingBalances']): number {
  return balances.cash + balances.taxableBrokerage;
}

function formatFplBand(band: FplBand): string {
  switch (band) {
    case 'below-aca':
      return 'below 138% FPL';
    case 'aca-low':
      return '138-200% FPL';
    case 'aca-mid':
      return '200-400% FPL';
    case 'aca-high':
      return '400-500% FPL';
    case 'above-cliff':
      return 'above 500% FPL';
  }
}

function formatYears(years: number): string {
  return `${years} ${years === 1 ? 'yr' : 'yrs'}`;
}

function formatDollars(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}
