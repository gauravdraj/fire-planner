import { CONSTANTS_2026 } from './constants/2026';
import { effectiveConstants } from './constants/customLaw';
import { indexBracketsForYear, type AccountBalances, type HealthcarePhase, type Scenario, type YearBreakdown } from './projection';
import { computeTaxableIncome } from './tax/federal';
import { getFPLForCoverageYear, type FplRegion, type FplTable } from './tax/aca';
import type { BracketTable, FilingStatus } from './types';

const SUPPORTED_BALANCE_KEYS = ['cash', 'hsa', 'taxableBrokerage', 'traditional', 'roth'] as const;
const WITHDRAWAL_RATE_NUMERATOR_KEYS = ['cash', 'taxableBrokerage', 'traditional', 'roth'] as const;
const FPL_HOUSEHOLD_SIZE_KEYS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const LARGE_BALANCE_DROP_MIN_AMOUNT = 50_000;
const LARGE_BALANCE_DROP_MIN_PERCENTAGE = 0.1;

type FplHouseholdSize = (typeof FPL_HOUSEHOLD_SIZE_KEYS)[number];

export type ProjectionMetricFormValues = Readonly<{
  currentYear: number;
  primaryAge: number;
  retirementYear: number;
  annualSocialSecurityBenefit: number;
  socialSecurityClaimAge: number;
}>;

export type BalanceMetric = Readonly<{
  amount: number;
  year: number;
}>;

export type YearsFundedMetric = Readonly<{
  count: number;
  depletedYear: number | null;
  fundedThroughYear: number | null;
}>;

export type BridgeWindowReason = 'medicare' | 'socialSecurity' | 'tenYearFallback';

export type BridgeWindow = Readonly<{
  startYear: number;
  endYear: number;
  reason: BridgeWindowReason;
  years: readonly YearBreakdown[];
}>;

export type FplBand = 'below-aca' | 'aca-low' | 'aca-mid' | 'aca-high' | 'above-cliff';

export type WithdrawalRateBand = 'safe' | 'caution' | 'danger' | 'catastrophic';

export type FederalBracketProximity = Readonly<{
  marginalRate: number;
  nextEdge: number | null;
  distanceToNextEdge: number | null;
}>;

export type YearPhaseLabel = 'SS claimed' | 'Medicare-eligible' | 'Bridge' | 'Pre-RE';

export type YearDisplayMetricContext = Readonly<{
  formValues: ProjectionMetricFormValues;
  priorYear?: YearBreakdown | null;
  scenario: Scenario;
}>;

export type YearDisplayMetrics = Readonly<{
  year: number;
  age: number;
  phaseLabel: YearPhaseLabel;
  wages: number;
  taxableIncome: number;
  federalBracketProximity: FederalBracketProximity;
  totalOpeningBalance: number;
  totalClosingBalance: number;
  totalWithdrawals: number;
  totalDisplayedIncome: number;
  fplPercentage: number | null;
  fplBand: FplBand | null;
  withdrawalRate: number | null;
  withdrawalRateBand: WithdrawalRateBand | null;
  irmaaTier: number | null;
  ltcgRealized: number | null;
}>;

export type YearChangeSummaryKind =
  | 'federal-bracket-crossing'
  | 'irmaa-tier-crossing'
  | 'brokerage-basis-depletion'
  | 'large-balance-drop'
  | 'aca-cliff-risk-crossing';

export type YearChangeSummary = Readonly<{
  kind: YearChangeSummaryKind;
  year: number;
  label: string;
  detail: string;
  from: number | null;
  to: number | null;
  priority: number;
}>;

export type YearOverYearChangeInput = Readonly<{
  formValues: ProjectionMetricFormValues;
  projectionResults: readonly YearBreakdown[];
  scenario: Scenario;
  targetYear: number;
}>;

export type ProjectionRunChangeInput = Readonly<{
  currentFormValues: ProjectionMetricFormValues;
  currentProjectionResults: readonly YearBreakdown[];
  currentScenario: Scenario;
  previousFormValues?: ProjectionMetricFormValues;
  previousProjectionResults: readonly YearBreakdown[];
  previousScenario?: Scenario;
  targetYear: number;
}>;

export type FplPercentageOptions = Readonly<{
  fplTable?: FplTable;
  region?: FplRegion;
}>;

export function computeNetWorthAtRetirement(
  projectionResults: readonly YearBreakdown[],
  retirementYear: number,
): BalanceMetric | null {
  const retirementBreakdown = projectionResults.find((breakdown) => breakdown.year === retirementYear) ?? null;

  return retirementBreakdown === null
    ? null
    : {
        amount: sumSupportedBalances(retirementBreakdown.openingBalances),
        year: retirementBreakdown.year,
      };
}

export function computePlanEndBalance(projectionResults: readonly YearBreakdown[]): BalanceMetric | null {
  const finalBreakdown = projectionResults.at(-1) ?? null;

  return finalBreakdown === null
    ? null
    : {
        amount: sumSupportedBalances(finalBreakdown.closingBalances),
        year: finalBreakdown.year,
      };
}

export function computeYearsFundedFromRetirement(
  projectionResults: readonly YearBreakdown[],
  retirementYear: number,
): YearsFundedMetric {
  let count = 0;
  let expectedYear = retirementYear;
  let fundedThroughYear: number | null = null;

  for (const breakdown of projectionResults) {
    if (breakdown.year < retirementYear) {
      continue;
    }

    if (breakdown.year !== expectedYear) {
      break;
    }

    count += 1;
    fundedThroughYear = breakdown.year;

    if (sumSupportedBalances(breakdown.closingBalances) <= 0) {
      return {
        count,
        depletedYear: breakdown.year,
        fundedThroughYear,
      };
    }

    expectedYear += 1;
  }

  return {
    count,
    depletedYear: null,
    fundedThroughYear,
  };
}

export function selectBridgeWindow(
  formValues: ProjectionMetricFormValues,
  projectionResults: readonly YearBreakdown[],
): BridgeWindow {
  const startYear = formValues.retirementYear;
  const medicareEligibilityYear = formValues.currentYear + (65 - formValues.primaryAge);
  const socialSecurityClaimYear = formValues.currentYear + (formValues.socialSecurityClaimAge - formValues.primaryAge);
  const { endYear, reason } = selectBridgeWindowEndYear({
    medicareEligibilityYear,
    retirementYear: startYear,
    socialSecurityAnnualBenefit: formValues.annualSocialSecurityBenefit,
    socialSecurityClaimYear,
  });

  return {
    startYear,
    endYear,
    reason,
    years: projectionResults.filter((breakdown) => breakdown.year >= startYear && breakdown.year <= endYear),
  };
}

export function computeAverageBridgeAcaMagi(bridgeYears: readonly YearBreakdown[]): number | null {
  if (bridgeYears.length === 0) {
    return null;
  }

  return sumBy(bridgeYears, (breakdown) => breakdown.acaMagi) / bridgeYears.length;
}

export function computeMaxBridgeGrossBucketDrawPercentage(bridgeYears: readonly YearBreakdown[]): number | null {
  if (bridgeYears.length === 0) {
    return null;
  }

  return Math.max(
    ...bridgeYears.map((breakdown) => {
      const openingBalance = sumSupportedBalances(breakdown.openingBalances);

      return openingBalance <= 0 ? 0 : sumSupportedBalances(breakdown.withdrawals) / openingBalance;
    }),
  );
}

export function computeTotalBridgeTax(bridgeYears: readonly YearBreakdown[]): number | null {
  if (bridgeYears.length === 0) {
    return null;
  }

  return roundToCents(sumBy(bridgeYears, (breakdown) => breakdown.totalTax));
}

export function computeFplPercentage(
  householdIncome: number,
  householdSize: number,
  options: FplPercentageOptions = {},
): number {
  const region = options.region ?? 'contiguous';
  const fplTable = options.fplTable ?? CONSTANTS_2026.fpl;
  const povertyGuideline = getPovertyGuideline(fplTable, householdSize, region);

  return povertyGuideline <= 0 ? 0 : Math.max(0, householdIncome) / povertyGuideline;
}

export function pickFplHouseholdSize(filingStatus: FilingStatus): 1 | 2 {
  return filingStatus === 'mfj' ? 2 : 1;
}

export function computeWithdrawalRate(
  year: YearBreakdown,
  priorYear: YearBreakdown | null | undefined,
  scenario?: Scenario,
): number | null {
  if (priorYear === null || priorYear === undefined) {
    return null;
  }

  const priorClosingBalance = sumSupportedBalances(priorYear.closingBalances);
  if (priorClosingBalance <= 0) {
    return null;
  }

  const mortgageAdjustment =
    scenario?.autoDepleteBrokerage?.excludeMortgageFromRate === true ? pAndIBeforePayoff(scenario, year.year) : 0;
  const adjustedWithdrawals = Math.max(0, sumWithdrawalRateNumerator(year.withdrawals) - mortgageAdjustment);

  return adjustedWithdrawals / priorClosingBalance;
}

export function pAndIBeforePayoff(scenario: Scenario, year: number): number {
  const annualPI = Math.max(0, scenario.mortgage?.annualPI ?? 0);
  const payoffYear = scenario.mortgage?.payoffYear;

  if (annualPI <= 0 || payoffYear === undefined || !Number.isFinite(payoffYear) || year > payoffYear) {
    return 0;
  }

  return roundToCents(annualPI);
}

export function computeFplBand(fplPercentage: number): FplBand {
  if (fplPercentage < 1.38) {
    return 'below-aca';
  }
  if (fplPercentage < 2) {
    return 'aca-low';
  }
  if (fplPercentage < 3) {
    return 'aca-mid';
  }
  if (fplPercentage <= 4) {
    return 'aca-high';
  }

  return 'above-cliff';
}

export function computeWithdrawalRateBand(withdrawalRate: number): WithdrawalRateBand {
  if (withdrawalRate < 0.04) {
    return 'safe';
  }
  if (withdrawalRate < 0.05) {
    return 'caution';
  }
  if (withdrawalRate <= 0.1) {
    return 'danger';
  }

  return 'catastrophic';
}

export function computeFederalBracketProximity(
  taxableIncome: number,
  filingStatus: FilingStatus = 'single',
  brackets: BracketTable = CONSTANTS_2026.federal.ordinaryBrackets,
): FederalBracketProximity {
  const income = Math.max(0, taxableIncome);
  const statusBrackets = brackets[filingStatus];
  if (statusBrackets.length === 0) {
    throw new Error(`Federal bracket table for ${filingStatus} is empty`);
  }

  let currentIndex = 0;
  for (let index = 0; index < statusBrackets.length; index += 1) {
    const bracket = statusBrackets[index];
    if (bracket !== undefined && income >= bracket.from) {
      currentIndex = index;
    }
  }

  const currentBracket = statusBrackets[currentIndex];
  if (currentBracket === undefined) {
    throw new Error(`Federal bracket table for ${filingStatus} is empty`);
  }

  const nextBracket = statusBrackets[currentIndex + 1] ?? null;

  return {
    marginalRate: currentBracket.rate,
    nextEdge: nextBracket?.from ?? null,
    distanceToNextEdge: nextBracket === null ? null : roundToCents(Math.max(0, nextBracket.from - income)),
  };
}

export function computeYearDisplayMetrics(
  breakdown: YearBreakdown,
  context: YearDisplayMetricContext,
): YearDisplayMetrics {
  const taxableIncome = computeProjectedTaxableIncome(context.scenario, breakdown);
  const indexedOrdinaryBrackets = indexBracketsForYear(
    effectiveConstants(context.scenario).federal.ordinaryBrackets,
    breakdown.year,
    context.scenario.inflationRate,
  ) as BracketTable;
  const fplPercentage = computeDisplayFplPercentage(breakdown, context.scenario);
  const withdrawalRate = computeWithdrawalRate(breakdown, context.priorYear, context.scenario);

  return {
    year: breakdown.year,
    age: context.formValues.primaryAge + (breakdown.year - context.formValues.currentYear),
    phaseLabel: computePhaseLabel(breakdown, context),
    wages: sumAnnualAmounts(context.scenario.w2Income, breakdown.year),
    taxableIncome,
    federalBracketProximity: computeFederalBracketProximity(
      taxableIncome,
      context.scenario.filingStatus,
      indexedOrdinaryBrackets,
    ),
    totalOpeningBalance: sumSupportedBalances(breakdown.openingBalances),
    totalClosingBalance: sumSupportedBalances(breakdown.closingBalances),
    totalWithdrawals: sumSupportedBalances(breakdown.withdrawals),
    totalDisplayedIncome: breakdown.agi,
    fplPercentage,
    fplBand: fplPercentage === null ? null : computeFplBand(fplPercentage),
    withdrawalRate,
    withdrawalRateBand: withdrawalRate === null ? null : computeWithdrawalRateBand(withdrawalRate),
    irmaaTier: breakdown.irmaaPremium?.tier ?? null,
    ltcgRealized: breakdown.brokerageBasis.realizedGainOrLoss,
  };
}

export function summarizeYearOverYearChanges(input: YearOverYearChangeInput): readonly YearChangeSummary[] {
  const currentIndex = input.projectionResults.findIndex((breakdown) => breakdown.year === input.targetYear);
  if (currentIndex <= 0) {
    return [];
  }

  const previousYear = input.projectionResults[currentIndex - 1];
  const currentYear = input.projectionResults[currentIndex];
  if (previousYear === undefined || currentYear === undefined) {
    return [];
  }

  return summarizeDisplayMetricChanges({
    currentFormValues: input.formValues,
    currentScenario: input.scenario,
    currentYear,
    previousFormValues: input.formValues,
    previousScenario: input.scenario,
    previousYear,
  });
}

export function summarizeProjectionRunChanges(input: ProjectionRunChangeInput): readonly YearChangeSummary[] {
  const previousYear = input.previousProjectionResults.find((breakdown) => breakdown.year === input.targetYear);
  const currentYear = input.currentProjectionResults.find((breakdown) => breakdown.year === input.targetYear);
  if (previousYear === undefined || currentYear === undefined) {
    return [];
  }

  return summarizeDisplayMetricChanges({
    currentFormValues: input.currentFormValues,
    currentScenario: input.currentScenario,
    currentYear,
    previousFormValues: input.previousFormValues ?? input.currentFormValues,
    previousScenario: input.previousScenario ?? input.currentScenario,
    previousYear,
  });
}

function getPovertyGuideline(table: FplTable, householdSize: number, region: FplRegion): number {
  if (!Number.isInteger(householdSize) || householdSize < 1) {
    throw new Error('FPL householdSize must be a positive integer');
  }

  const regionTable = table[region];
  if (householdSize <= 8) {
    return regionTable.householdSize[householdSize as FplHouseholdSize];
  }

  return regionTable.householdSize[8] + (householdSize - 8) * regionTable.additionalPerPerson;
}

function computeProjectedTaxableIncome(scenario: Scenario, breakdown: YearBreakdown): number {
  const constants = effectiveConstants(scenario);
  const taxableIncomeBeforeQbi = computeTaxableIncome(breakdown.agi, scenario.filingStatus, {
    magi: breakdown.irmaaMagi,
    standardDeduction: constants.federal.standardDeduction,
    ...(scenario.age65Plus !== undefined ? { age65Plus: scenario.age65Plus } : {}),
    ...(scenario.partnerAge65Plus !== undefined ? { partnerAge65Plus: scenario.partnerAge65Plus } : {}),
  });

  return roundToCents(Math.max(0, taxableIncomeBeforeQbi - breakdown.qbiDeduction));
}

function computeDisplayFplPercentage(breakdown: YearBreakdown, scenario: Scenario): number | null {
  const healthcarePhase = getHealthcarePhase(scenario.healthcare, breakdown.year);
  const fplTable = getFPLForCoverageYear({
    coverageYear: breakdown.year,
    fplIndexingRate: scenario.inflationRate,
  });

  if (healthcarePhase.kind === 'aca') {
    if (breakdown.acaPremiumCredit !== null) {
      return breakdown.acaPremiumCredit.fplPercent;
    }

    return computeFplPercentage(breakdown.acaMagi, healthcarePhase.householdSize, {
      fplTable,
      ...(healthcarePhase.region !== undefined ? { region: healthcarePhase.region } : {}),
    });
  }

  return computeFplPercentage(breakdown.acaMagi, pickFplHouseholdSize(scenario.filingStatus), {
    fplTable,
  });
}

function computePhaseLabel(breakdown: YearBreakdown, context: YearDisplayMetricContext): YearPhaseLabel {
  const claimYear =
    context.scenario.socialSecurity?.claimYear ??
    context.formValues.currentYear + (context.formValues.socialSecurityClaimAge - context.formValues.primaryAge);
  const socialSecurityAnnualBenefit =
    context.scenario.socialSecurity?.annualBenefit ?? context.formValues.annualSocialSecurityBenefit;
  if (socialSecurityAnnualBenefit > 0 && breakdown.year >= claimYear) {
    return 'SS claimed';
  }

  const age = context.formValues.primaryAge + (breakdown.year - context.formValues.currentYear);
  if (age >= 65 || getHealthcarePhase(context.scenario.healthcare, breakdown.year).kind === 'medicare') {
    return 'Medicare-eligible';
  }

  if (breakdown.year >= context.formValues.retirementYear) {
    return 'Bridge';
  }

  return 'Pre-RE';
}

function getHealthcarePhase(phases: readonly HealthcarePhase[], year: number): HealthcarePhase {
  return phases.find((phase) => phase.year === year) ?? { year, kind: 'none' };
}

function summarizeDisplayMetricChanges({
  currentFormValues,
  currentScenario,
  currentYear,
  previousFormValues,
  previousScenario,
  previousYear,
}: {
  currentFormValues: ProjectionMetricFormValues;
  currentScenario: Scenario;
  currentYear: YearBreakdown;
  previousFormValues: ProjectionMetricFormValues;
  previousScenario: Scenario;
  previousYear: YearBreakdown;
}): readonly YearChangeSummary[] {
  const previousMetrics = computeYearDisplayMetrics(previousYear, {
    formValues: previousFormValues,
    scenario: previousScenario,
  });
  const currentMetrics = computeYearDisplayMetrics(currentYear, {
    formValues: currentFormValues,
    scenario: currentScenario,
  });
  const summaries: YearChangeSummary[] = [];

  if (previousMetrics.federalBracketProximity.marginalRate !== currentMetrics.federalBracketProximity.marginalRate) {
    summaries.push({
      kind: 'federal-bracket-crossing',
      year: currentYear.year,
      label: 'Federal bracket changed',
      detail: `Marginal federal rate moved from ${formatPercentage(previousMetrics.federalBracketProximity.marginalRate)} to ${formatPercentage(currentMetrics.federalBracketProximity.marginalRate)}.`,
      from: previousMetrics.federalBracketProximity.marginalRate,
      to: currentMetrics.federalBracketProximity.marginalRate,
      priority: 1,
    });
  }

  if (previousMetrics.irmaaTier !== currentMetrics.irmaaTier) {
    summaries.push({
      kind: 'irmaa-tier-crossing',
      year: currentYear.year,
      label: 'IRMAA tier changed',
      detail: `IRMAA tier moved from ${formatNullableNumber(previousMetrics.irmaaTier)} to ${formatNullableNumber(currentMetrics.irmaaTier)}.`,
      from: previousMetrics.irmaaTier,
      to: currentMetrics.irmaaTier,
      priority: 2,
    });
  }

  if (previousYear.brokerageBasis.closing > 0 && currentYear.brokerageBasis.closing <= 0) {
    summaries.push({
      kind: 'brokerage-basis-depletion',
      year: currentYear.year,
      label: 'Brokerage basis depleted',
      detail: 'Taxable brokerage basis reached zero, so future taxable sales may realize more gains.',
      from: previousYear.brokerageBasis.closing,
      to: currentYear.brokerageBasis.closing,
      priority: 3,
    });
  }

  const balanceDrop = previousMetrics.totalClosingBalance - currentMetrics.totalClosingBalance;
  const balanceDropPercentage =
    previousMetrics.totalClosingBalance <= 0 ? 0 : balanceDrop / previousMetrics.totalClosingBalance;
  if (balanceDrop >= LARGE_BALANCE_DROP_MIN_AMOUNT && balanceDropPercentage >= LARGE_BALANCE_DROP_MIN_PERCENTAGE) {
    summaries.push({
      kind: 'large-balance-drop',
      year: currentYear.year,
      label: 'Large balance drop',
      detail: `Closing balance fell by ${formatPercentage(balanceDropPercentage)} from the comparison year.`,
      from: previousMetrics.totalClosingBalance,
      to: currentMetrics.totalClosingBalance,
      priority: 4,
    });
  }

  if (
    previousMetrics.fplPercentage !== null &&
    currentMetrics.fplPercentage !== null &&
    isAcaCliffRisk(previousMetrics.fplBand) !== isAcaCliffRisk(currentMetrics.fplBand)
  ) {
    summaries.push({
      kind: 'aca-cliff-risk-crossing',
      year: currentYear.year,
      label: 'ACA cliff risk changed',
      detail: `FPL moved from ${formatPercentage(previousMetrics.fplPercentage)} to ${formatPercentage(currentMetrics.fplPercentage)}.`,
      from: previousMetrics.fplPercentage,
      to: currentMetrics.fplPercentage,
      priority: 5,
    });
  }

  return summaries.sort((left, right) => left.priority - right.priority).slice(0, 3);
}

function isAcaCliffRisk(band: FplBand | null): boolean {
  return band === 'aca-high' || band === 'above-cliff';
}

function sumAnnualAmounts(entries: readonly { year: number; amount: number }[], year: number): number {
  return entries.reduce((total, entry) => total + (entry.year === year ? entry.amount : 0), 0);
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'none' : String(value);
}

function selectBridgeWindowEndYear({
  medicareEligibilityYear,
  retirementYear,
  socialSecurityAnnualBenefit,
  socialSecurityClaimYear,
}: {
  medicareEligibilityYear: number;
  retirementYear: number;
  socialSecurityAnnualBenefit: number;
  socialSecurityClaimYear: number;
}): { endYear: number; reason: BridgeWindowReason } {
  /*
   * Bridge metrics prioritize the pre-Medicare span, then the pre-Social
   * Security span when a benefit is modeled, then ten retirement years.
   */
  if (medicareEligibilityYear > retirementYear) {
    return {
      endYear: medicareEligibilityYear - 1,
      reason: 'medicare',
    };
  }

  if (socialSecurityAnnualBenefit > 0 && socialSecurityClaimYear > retirementYear) {
    return {
      endYear: socialSecurityClaimYear - 1,
      reason: 'socialSecurity',
    };
  }

  return {
    endYear: retirementYear + 9,
    reason: 'tenYearFallback',
  };
}

function sumSupportedBalances(balances: AccountBalances): number {
  return SUPPORTED_BALANCE_KEYS.reduce((total, key) => total + balances[key], 0);
}

function sumWithdrawalRateNumerator(withdrawals: AccountBalances): number {
  return WITHDRAWAL_RATE_NUMERATOR_KEYS.reduce((total, key) => total + withdrawals[key], 0);
}

function sumBy<TValue>(values: readonly TValue[], getValue: (value: TValue) => number): number {
  return values.reduce((total, value) => total + getValue(value), 0);
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}
