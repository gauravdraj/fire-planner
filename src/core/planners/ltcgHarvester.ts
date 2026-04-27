import { CONSTANTS_2026 } from '../constants/2026';
import { effectiveConstants } from '../constants/customLaw';
import { indexBracketsForYear, runProjection, type HealthcarePhase, type Scenario, type WithdrawalPlan, type YearBreakdown } from '../projection';
import { getFPLForCoverageYear, type FplRegion, type FplTable } from '../tax/aca';
import { computeTaxableIncome } from '../tax/federal';
import type { FilingStatus, LtcgBracketTable } from '../types';

/*
 * Gate 4 0% LTCG harvester.
 *
 * The harvester probes the existing projection engine and writes normal
 * WithdrawalPlan.brokerageHarvests entries. It intentionally does not duplicate
 * withdrawal allocation, ACA, IRMAA, or tax calculations.
 */

export const LTCG_HARVESTER_SOLVER_TOLERANCE_DOLLARS = 1;

const MAX_SOLVER_ITERATIONS = 40;
const CENT = 0.01;

export type ComputeLtcg0PctHeadroomInput = Readonly<{
  filingStatus: FilingStatus;
  ordinaryTaxableIncome: number;
  alreadyRealizedLtcg?: number;
  brackets?: LtcgBracketTable;
}>;

export type LtcgHarvesterAcaGuard = Readonly<{
  maxFplPercent: number;
}>;

export type LtcgHarvesterIrmaaGuard = Readonly<{
  maxTier: number;
}>;

export type GenerateLtcgHarvestPlanInput = Readonly<{
  scenario: Scenario;
  basePlan: WithdrawalPlan;
  startYear?: number;
  endYear?: number;
  maxHarvest?: number;
  remainingUnrealizedGainFloor?: number;
  acaGuard?: LtcgHarvesterAcaGuard;
  irmaaGuard?: LtcgHarvesterIrmaaGuard;
  toleranceDollars?: number;
}>;

export type LtcgHarvestStatus =
  | 'harvested'
  | 'no-ltcg-headroom'
  | 'no-unrealized-gain'
  | 'limited-by-max-harvest'
  | 'limited-by-unrealized-gain-floor'
  | 'limited-by-aca-guard'
  | 'limited-by-irmaa-guard'
  | 'already-over-aca-guard'
  | 'already-over-irmaa-guard';

export type LtcgHarvestYearResult = Readonly<{
  year: number;
  harvestAmount: number;
  ordinaryTaxableIncome: number;
  preferentialTaxableIncome: number;
  realizedLtcg: number;
  ltcg0PctHeadroom: number;
  acaMagi: number;
  irmaaMagi: number;
  acaGuardMargin: number | null;
  irmaaGuardMargin: number | null;
  constraintMet: boolean;
  status: LtcgHarvestStatus;
}>;

export type LtcgHarvestPlanResult = Readonly<{
  plan: WithdrawalPlan;
  years: readonly LtcgHarvestYearResult[];
}>;

type CandidateEvaluation = Readonly<{
  harvestAmount: number;
  breakdown: YearBreakdown;
  ordinaryTaxableIncome: number;
  preferentialTaxableIncome: number;
  realizedLtcg: number;
  ltcg0PctHeadroom: number;
  ltcg0PctMargin: number;
  acaGuardMargin: number | null;
  irmaaGuardMargin: number | null;
}>;

type UpperBound = Readonly<{
  amount: number;
  limitedBy: 'unrealized-gain' | 'max-harvest' | 'unrealized-gain-floor';
}>;

export function computeLtcg0PctHeadroom(input: ComputeLtcg0PctHeadroomInput): number {
  return roundToCents(Math.max(0, computeSignedLtcg0PctHeadroom(input)));
}

function computeSignedLtcg0PctHeadroom(input: ComputeLtcg0PctHeadroomInput): number {
  const brackets = (input.brackets ?? CONSTANTS_2026.ltcg.brackets)[input.filingStatus];
  const zeroPercentUpperBound = getZeroPercentUpperBound(brackets);
  if (zeroPercentUpperBound === null) {
    return 0;
  }

  return roundToCents(
    zeroPercentUpperBound - Math.max(0, input.ordinaryTaxableIncome) - Math.max(0, input.alreadyRealizedLtcg ?? 0),
  );
}

export function generateLtcgHarvestPlan(input: GenerateLtcgHarvestPlanInput): LtcgHarvestPlanResult {
  const startYear = input.startYear ?? input.scenario.startYear;
  const endYear = input.endYear ?? input.basePlan.endYear;
  const toleranceDollars = normalizeTolerance(input.toleranceDollars);

  if (startYear < input.scenario.startYear) {
    throw new Error('LTCG harvest plan startYear cannot be before scenario.startYear');
  }
  if (endYear < startYear) {
    throw new Error('LTCG harvest plan endYear must be at least startYear');
  }

  let plan = withoutBrokerageHarvestsInRange(
    {
      ...input.basePlan,
      endYear: Math.max(input.basePlan.endYear, endYear),
    },
    startYear,
    endYear,
  );
  const years: LtcgHarvestYearResult[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const result = computeHarvestForYear(input.scenario, plan, year, input, toleranceDollars);

    years.push(result);
    plan = setBrokerageHarvestForYear(plan, year, result.harvestAmount);
  }

  return { plan, years };
}

function computeHarvestForYear(
  scenario: Scenario,
  plan: WithdrawalPlan,
  year: number,
  input: GenerateLtcgHarvestPlanInput,
  toleranceDollars: number,
): LtcgHarvestYearResult {
  const workingPlan = withoutBrokerageHarvestForYear(plan, year);
  const baseEvaluation = evaluateCandidate(scenario, workingPlan, year, input, 0);

  if ((baseEvaluation.acaGuardMargin ?? 0) < -toleranceDollars) {
    return resultFromEvaluation(baseEvaluation, year, 'already-over-aca-guard', toleranceDollars);
  }
  if ((baseEvaluation.irmaaGuardMargin ?? 0) < -toleranceDollars) {
    return resultFromEvaluation(baseEvaluation, year, 'already-over-irmaa-guard', toleranceDollars);
  }
  if (baseEvaluation.ltcg0PctHeadroom <= CENT) {
    return resultFromEvaluation(baseEvaluation, year, 'no-ltcg-headroom', toleranceDollars);
  }

  const upperBound = computeHarvestUpperBound(baseEvaluation.breakdown, input.maxHarvest, input.remainingUnrealizedGainFloor);
  if (upperBound.amount <= CENT) {
    return resultFromEvaluation(baseEvaluation, year, statusForUpperBound(upperBound), toleranceDollars);
  }

  const highEvaluation = evaluateCandidate(scenario, workingPlan, year, input, upperBound.amount);
  if (isFeasible(highEvaluation, toleranceDollars)) {
    const status =
      upperBound.limitedBy === 'unrealized-gain' && Math.abs(highEvaluation.ltcg0PctMargin) <= toleranceDollars
        ? 'harvested'
        : statusForUpperBound(upperBound);
    return resultFromEvaluation(highEvaluation, year, status, toleranceDollars);
  }

  let lowAmount = 0;
  let highAmount = upperBound.amount;
  let lowEvaluation = baseEvaluation;

  for (let iteration = 0; iteration < MAX_SOLVER_ITERATIONS && highAmount - lowAmount > toleranceDollars; iteration += 1) {
    const midAmount = roundToCents((lowAmount + highAmount) / 2);
    const midEvaluation = evaluateCandidate(scenario, workingPlan, year, input, midAmount);

    if (isFeasible(midEvaluation, toleranceDollars)) {
      lowAmount = midAmount;
      lowEvaluation = midEvaluation;
    } else {
      highAmount = midAmount;
    }
  }

  return resultFromEvaluation(lowEvaluation, year, limitingStatus(lowEvaluation), toleranceDollars);
}

function evaluateCandidate(
  scenario: Scenario,
  plan: WithdrawalPlan,
  year: number,
  input: GenerateLtcgHarvestPlanInput,
  harvestAmount: number,
): CandidateEvaluation {
  const candidateAmount = roundToCents(Math.max(0, harvestAmount));
  const candidatePlan = setBrokerageHarvestForYear(
    {
      ...plan,
      endYear: Math.max(plan.endYear, year),
    },
    year,
    candidateAmount,
  );
  const breakdown = runProjection(scenario, candidatePlan).find((candidateYear) => candidateYear.year === year);

  if (breakdown === undefined) {
    throw new Error(`Projection did not return target year ${year}`);
  }

  const taxableIncome = computeProjectedTaxableIncome(scenario, breakdown);
  const realizedLtcg = Math.max(0, breakdown.brokerageBasis.realizedGainOrLoss);
  const qualifiedDividends = sumAnnualAmounts(scenario.qualifiedDividends ?? [], year);
  const preferentialIncome = Math.max(0, qualifiedDividends + realizedLtcg);
  const preferentialTaxableIncome = roundToCents(Math.min(preferentialIncome, taxableIncome));
  const ordinaryTaxableIncome = roundToCents(Math.max(0, taxableIncome - preferentialTaxableIncome));
  const indexedLtcgBrackets = indexBracketsForYear(
    effectiveConstants(scenario).ltcg.brackets,
    year,
    scenario.inflationRate,
  ) as LtcgBracketTable;

  const ltcg0PctMargin = computeSignedLtcg0PctHeadroom({
    filingStatus: scenario.filingStatus,
    ordinaryTaxableIncome,
    alreadyRealizedLtcg: preferentialTaxableIncome,
    brackets: indexedLtcgBrackets,
  });

  return {
    harvestAmount: roundToCents(breakdown.brokerageHarvests),
    breakdown,
    ordinaryTaxableIncome,
    preferentialTaxableIncome,
    realizedLtcg: roundToCents(realizedLtcg),
    ltcg0PctHeadroom: roundToCents(Math.max(0, ltcg0PctMargin)),
    ltcg0PctMargin,
    acaGuardMargin: computeAcaGuardMargin(scenario, year, input.acaGuard, breakdown.acaMagi),
    irmaaGuardMargin: computeIrmaaGuardMargin(scenario, input.irmaaGuard, breakdown.irmaaMagi),
  };
}

function resultFromEvaluation(
  evaluation: CandidateEvaluation,
  year: number,
  status: LtcgHarvestStatus,
  toleranceDollars: number,
): LtcgHarvestYearResult {
  return {
    year,
    harvestAmount: roundToCents(evaluation.harvestAmount),
    ordinaryTaxableIncome: roundToCents(evaluation.ordinaryTaxableIncome),
    preferentialTaxableIncome: roundToCents(evaluation.preferentialTaxableIncome),
    realizedLtcg: roundToCents(evaluation.realizedLtcg),
    ltcg0PctHeadroom: roundToCents(evaluation.ltcg0PctHeadroom),
    acaMagi: roundToCents(evaluation.breakdown.acaMagi),
    irmaaMagi: roundToCents(evaluation.breakdown.irmaaMagi),
    acaGuardMargin: roundNullable(evaluation.acaGuardMargin),
    irmaaGuardMargin: roundNullable(evaluation.irmaaGuardMargin),
    constraintMet: isFeasible(evaluation, toleranceDollars),
    status,
  };
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

function computeHarvestUpperBound(
  breakdown: YearBreakdown,
  maxHarvest: number | undefined,
  remainingUnrealizedGainFloor: number | undefined,
): UpperBound {
  const balanceAfterWithdrawals = Math.max(0, breakdown.openingBalances.taxableBrokerage - breakdown.withdrawals.taxableBrokerage);
  const basisAfterWithdrawals = Math.max(0, breakdown.brokerageBasis.opening - breakdown.brokerageBasis.sold);
  const embeddedGain = roundToCents(Math.max(0, balanceAfterWithdrawals - basisAfterWithdrawals));
  const floorLimitedGain = roundToCents(Math.max(0, embeddedGain - Math.max(0, remainingUnrealizedGainFloor ?? 0)));

  let amount = floorLimitedGain;
  let limitedBy: UpperBound['limitedBy'] =
    remainingUnrealizedGainFloor !== undefined && floorLimitedGain < embeddedGain
      ? 'unrealized-gain-floor'
      : 'unrealized-gain';

  if (maxHarvest !== undefined && Math.max(0, maxHarvest) < amount) {
    amount = roundToCents(Math.max(0, maxHarvest));
    limitedBy = 'max-harvest';
  }

  return { amount, limitedBy };
}

function computeAcaGuardMargin(
  scenario: Scenario,
  year: number,
  guard: LtcgHarvesterAcaGuard | undefined,
  acaMagi: number,
): number | null {
  if (guard === undefined) {
    return null;
  }

  const healthcarePhase = getHealthcarePhase(scenario.healthcare, year);
  if (healthcarePhase.kind !== 'aca') {
    return null;
  }

  const fpl = getFPLForCoverageYear({
    coverageYear: year,
    fplIndexingRate: scenario.inflationRate,
  });
  const povertyGuideline = getPovertyGuideline(
    fpl,
    healthcarePhase.householdSize,
    healthcarePhase.region ?? 'contiguous',
  );

  return roundToCents(povertyGuideline * Math.max(0, guard.maxFplPercent) - acaMagi);
}

function computeIrmaaGuardMargin(
  scenario: Scenario,
  guard: LtcgHarvesterIrmaaGuard | undefined,
  irmaaMagi: number,
): number | null {
  if (guard === undefined) {
    return null;
  }

  const tiers = effectiveConstants(scenario).irmaa.partBTiers[scenario.filingStatus];
  const tier = tiers[guard.maxTier];
  if (tier === undefined) {
    throw new Error(`IRMAA tier ${guard.maxTier} is not available for ${scenario.filingStatus}`);
  }

  if ('magiUpToInclusive' in tier && tier.magiUpToInclusive !== undefined) {
    return roundToCents(tier.magiUpToInclusive - irmaaMagi);
  }
  if ('magiLessThan' in tier && tier.magiLessThan !== undefined) {
    return roundToCents(tier.magiLessThan - irmaaMagi);
  }

  return null;
}

function isFeasible(evaluation: CandidateEvaluation, toleranceDollars: number): boolean {
  return (
    evaluation.ltcg0PctMargin >= -CENT &&
    (evaluation.acaGuardMargin === null || evaluation.acaGuardMargin >= -toleranceDollars) &&
    (evaluation.irmaaGuardMargin === null || evaluation.irmaaGuardMargin >= -toleranceDollars)
  );
}

function limitingStatus(evaluation: CandidateEvaluation): LtcgHarvestStatus {
  const margins: Array<Readonly<{ status: LtcgHarvestStatus; margin: number }>> = [
    { status: 'harvested', margin: evaluation.ltcg0PctMargin },
  ];

  if (evaluation.acaGuardMargin !== null) {
    margins.push({ status: 'limited-by-aca-guard', margin: evaluation.acaGuardMargin });
  }
  if (evaluation.irmaaGuardMargin !== null) {
    margins.push({ status: 'limited-by-irmaa-guard', margin: evaluation.irmaaGuardMargin });
  }

  return margins.reduce((closest, candidate) => {
    return candidate.margin < closest.margin ? candidate : closest;
  }).status;
}

function statusForUpperBound(upperBound: UpperBound): LtcgHarvestStatus {
  switch (upperBound.limitedBy) {
    case 'max-harvest':
      return 'limited-by-max-harvest';
    case 'unrealized-gain-floor':
      return 'limited-by-unrealized-gain-floor';
    case 'unrealized-gain':
      return 'no-unrealized-gain';
  }
}

function getZeroPercentUpperBound(brackets: LtcgBracketTable[FilingStatus]): number | null {
  const zeroPercentBracketIndex = brackets.findIndex((bracket) => Math.abs(bracket.rate) < 1e-10);
  if (zeroPercentBracketIndex === -1) {
    return null;
  }

  return brackets[zeroPercentBracketIndex + 1]?.from ?? null;
}

function setBrokerageHarvestForYear(plan: WithdrawalPlan, year: number, amount: number): WithdrawalPlan {
  const roundedAmount = roundToCents(Math.max(0, amount));
  const brokerageHarvests = [
    ...(plan.brokerageHarvests ?? []).filter((harvest) => harvest.year !== year),
    ...(roundedAmount > CENT ? [{ year, amount: roundedAmount }] : []),
  ].sort((left, right) => left.year - right.year);

  return {
    ...plan,
    brokerageHarvests,
  };
}

function withoutBrokerageHarvestForYear(plan: WithdrawalPlan, year: number): WithdrawalPlan {
  return {
    ...plan,
    brokerageHarvests: (plan.brokerageHarvests ?? []).filter((harvest) => harvest.year !== year),
  };
}

function withoutBrokerageHarvestsInRange(plan: WithdrawalPlan, startYear: number, endYear: number): WithdrawalPlan {
  return {
    ...plan,
    brokerageHarvests: (plan.brokerageHarvests ?? []).filter((harvest) => {
      return harvest.year < startYear || harvest.year > endYear;
    }),
  };
}

function getHealthcarePhase(phases: readonly HealthcarePhase[], year: number): HealthcarePhase {
  return phases.find((phase) => phase.year === year) ?? { year, kind: 'none' };
}

function getPovertyGuideline(table: FplTable, householdSize: number, region: FplRegion): number {
  if (!Number.isInteger(householdSize) || householdSize < 1) {
    throw new Error('ACA householdSize must be a positive integer');
  }

  const regionTable = table[region];
  if (householdSize <= 8) {
    return regionTable.householdSize[householdSize as keyof typeof regionTable.householdSize];
  }

  return regionTable.householdSize[8] + (householdSize - 8) * regionTable.additionalPerPerson;
}

function sumAnnualAmounts(entries: readonly { year: number; amount: number }[], year: number): number {
  return entries.filter((entry) => entry.year === year).reduce((sum, entry) => sum + entry.amount, 0);
}

function normalizeTolerance(toleranceDollars: number | undefined): number {
  if (toleranceDollars === undefined) {
    return LTCG_HARVESTER_SOLVER_TOLERANCE_DOLLARS;
  }

  return Math.max(CENT, toleranceDollars);
}

function roundNullable(value: number | null): number | null {
  return value === null ? null : roundToCents(value);
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}
