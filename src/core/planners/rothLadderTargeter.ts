import { effectiveConstants } from '../constants/customLaw';
import { indexBracketsForYear, runProjection, type HealthcarePhase, type Scenario, type WithdrawalPlan, type YearBreakdown } from '../projection';
import { getFPLForCoverageYear, type FplRegion, type FplTable } from '../tax/aca';
import { computeTaxableIncome } from '../tax/federal';
import type { Bracket, BracketTable, LtcgBracketTable } from '../types';

/*
 * Gate 4 Roth ladder targeter.
 *
 * This is intentionally a per-year targeter, not a global optimizer. It probes
 * the existing projection engine with candidate Roth conversion amounts and
 * returns a normal WithdrawalPlan for the engine to consume.
 */

export const ROTH_LADDER_SOLVER_TOLERANCE_DOLLARS = 1;

const MAX_SOLVER_ITERATIONS = 40;
const CENT = 0.01;

export type RothLadderIrmaaTierConstraint = Readonly<{
  kind: 'irmaaTier';
  maxTier: number;
}>;

export type RothLadderAcaFplPercentageConstraint = Readonly<{
  kind: 'acaFplPercentage';
  /**
   * Ratio form used by core ACA outputs: 4 means 400% FPL.
   */
  maxFplPercent: number;
}>;

export type RothLadderFederalBracketConstraint = Readonly<{
  kind: 'federalBracket';
  bracketRate: number;
}>;

export type RothLadderLtcgBracketConstraint = Readonly<{
  kind: 'ltcgBracket';
  bracketRate: number;
}>;

export type RothLadderConstraint =
  | RothLadderIrmaaTierConstraint
  | RothLadderAcaFplPercentageConstraint
  | RothLadderFederalBracketConstraint
  | RothLadderLtcgBracketConstraint;

export type RothLadderConstraintStatus =
  | 'constraint-met'
  | 'already-over-target'
  | 'limited-by-traditional-balance'
  | 'limited-by-max-conversion'
  | 'no-traditional-balance'
  | 'inapplicable';

export type RothLadderIrmaaLookbackMetadata = Readonly<{
  magiYear: number;
  premiumYear: number;
  lookbackYears: 2;
  note: string;
}>;

export type RothLadderYearResult = Readonly<{
  year: number;
  conversionAmount: number;
  projectedAgi: number;
  acaMagi: number;
  irmaaMagi: number;
  taxableIncome: number;
  bindingMargin: number | null;
  constraintMet: boolean;
  status: RothLadderConstraintStatus;
  targetValue: number | null;
  measuredValue: number;
  irmaaLookback: RothLadderIrmaaLookbackMetadata;
}>;

export type ComputeRothLadderConversionForYearInput = Readonly<{
  scenario: Scenario;
  plan: WithdrawalPlan;
  year: number;
  constraint: RothLadderConstraint;
  maxConversion?: number;
  /**
   * The binary solver chooses the largest candidate that does not exceed the
   * binding target by more than this slack. The default $1 tolerance absorbs
   * cent rounding and projection feedback from taxes paid with withdrawals
   * while keeping constraintMet false for material target breaches.
   */
  toleranceDollars?: number;
}>;

export type GenerateRothLadderPlanInput = Readonly<{
  scenario: Scenario;
  basePlan: WithdrawalPlan;
  constraint: RothLadderConstraint;
  startYear?: number;
  endYear?: number;
  maxConversion?: number;
  toleranceDollars?: number;
}>;

export type RothLadderPlanResult = Readonly<{
  plan: WithdrawalPlan;
  years: readonly RothLadderYearResult[];
}>;

type ConstraintTarget = Readonly<{
  targetValue: number | null;
}>;

type CandidateEvaluation = Readonly<{
  conversionAmount: number;
  breakdown: YearBreakdown;
  measuredValue: number;
  taxableIncome: number;
}>;

type UpperBound = Readonly<{
  amount: number;
  limitedBy: 'traditional-balance' | 'max-conversion';
}>;

export function computeRothLadderConversionForYear(
  input: ComputeRothLadderConversionForYearInput,
): RothLadderYearResult {
  const toleranceDollars = normalizeTolerance(input.toleranceDollars);
  const workingPlan = withoutRothConversionForYear(input.plan, input.year);
  const target = computeConstraintTarget(input.scenario, input.year, input.constraint, toleranceDollars);
  const baseEvaluation = evaluateCandidate(input.scenario, workingPlan, input.year, input.constraint, 0);

  if (target.targetValue === null) {
    return resultFromEvaluation(baseEvaluation, input.year, null, 'inapplicable', toleranceDollars);
  }

  const baseMargin = target.targetValue - baseEvaluation.measuredValue;
  if (baseMargin < -toleranceDollars) {
    return resultFromEvaluation(baseEvaluation, input.year, target.targetValue, 'already-over-target', toleranceDollars);
  }

  const upperBound = computeConversionUpperBound(baseEvaluation.breakdown, input.maxConversion);
  if (upperBound.amount <= CENT) {
    const status = upperBound.limitedBy === 'max-conversion' ? 'limited-by-max-conversion' : 'no-traditional-balance';
    return resultFromEvaluation(baseEvaluation, input.year, target.targetValue, status, toleranceDollars);
  }

  const highEvaluation = evaluateCandidate(
    input.scenario,
    workingPlan,
    input.year,
    input.constraint,
    upperBound.amount,
  );
  const highMargin = target.targetValue - highEvaluation.measuredValue;
  if (highMargin >= -toleranceDollars) {
    const status =
      Math.abs(highMargin) <= toleranceDollars
        ? 'constraint-met'
        : upperBound.limitedBy === 'max-conversion'
          ? 'limited-by-max-conversion'
          : 'limited-by-traditional-balance';
    return resultFromEvaluation(highEvaluation, input.year, target.targetValue, status, toleranceDollars);
  }

  let lowAmount = 0;
  let highAmount = upperBound.amount;
  let lowEvaluation = baseEvaluation;

  for (let iteration = 0; iteration < MAX_SOLVER_ITERATIONS && highAmount - lowAmount > toleranceDollars; iteration += 1) {
    const midAmount = roundToCents((lowAmount + highAmount) / 2);
    const midEvaluation = evaluateCandidate(input.scenario, workingPlan, input.year, input.constraint, midAmount);
    const midMargin = target.targetValue - midEvaluation.measuredValue;

    if (midMargin >= -toleranceDollars) {
      lowAmount = midAmount;
      lowEvaluation = midEvaluation;
    } else {
      highAmount = midAmount;
    }
  }

  return resultFromEvaluation(lowEvaluation, input.year, target.targetValue, 'constraint-met', toleranceDollars);
}

export function generateRothLadderPlan(input: GenerateRothLadderPlanInput): RothLadderPlanResult {
  const startYear = input.startYear ?? input.scenario.startYear;
  const endYear = input.endYear ?? input.basePlan.endYear;

  if (startYear < input.scenario.startYear) {
    throw new Error('Roth ladder plan startYear cannot be before scenario.startYear');
  }
  if (endYear < startYear) {
    throw new Error('Roth ladder plan endYear must be at least startYear');
  }

  let plan = withoutRothConversionsInRange(
    {
      ...input.basePlan,
      endYear: Math.max(input.basePlan.endYear, endYear),
    },
    startYear,
    endYear,
  );
  const years: RothLadderYearResult[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const result = computeRothLadderConversionForYear({
      scenario: input.scenario,
      plan,
      year,
      constraint: input.constraint,
      ...(input.maxConversion !== undefined ? { maxConversion: input.maxConversion } : {}),
      ...(input.toleranceDollars !== undefined ? { toleranceDollars: input.toleranceDollars } : {}),
    });

    years.push(result);
    plan = setRothConversionForYear(plan, year, result.conversionAmount);
  }

  return { plan, years };
}

function computeConstraintTarget(
  scenario: Scenario,
  year: number,
  constraint: RothLadderConstraint,
  toleranceDollars: number,
): ConstraintTarget {
  const constants = effectiveConstants(scenario);

  switch (constraint.kind) {
    case 'irmaaTier': {
      const tiers = constants.irmaa.partBTiers[scenario.filingStatus];
      const tier = tiers[constraint.maxTier];
      if (tier === undefined) {
        throw new Error(`IRMAA tier ${constraint.maxTier} is not available for ${scenario.filingStatus}`);
      }

      if ('magiUpToInclusive' in tier && tier.magiUpToInclusive !== undefined) {
        return { targetValue: tier.magiUpToInclusive };
      }
      if ('magiLessThan' in tier && tier.magiLessThan !== undefined) {
        return { targetValue: Math.max(0, tier.magiLessThan - toleranceDollars) };
      }

      return { targetValue: null };
    }

    case 'acaFplPercentage': {
      const healthcarePhase = getHealthcarePhase(scenario.healthcare, year);
      if (healthcarePhase.kind !== 'aca') {
        return { targetValue: null };
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

      return { targetValue: povertyGuideline * Math.max(0, constraint.maxFplPercent) };
    }

    case 'federalBracket': {
      const indexedBrackets = indexBracketsForYear(
        constants.federal.ordinaryBrackets,
        year,
        scenario.inflationRate,
      ) as BracketTable;
      return { targetValue: getBracketUpperBound(indexedBrackets[scenario.filingStatus], constraint.bracketRate) };
    }

    case 'ltcgBracket': {
      const indexedBrackets = indexBracketsForYear(
        constants.ltcg.brackets,
        year,
        scenario.inflationRate,
      ) as LtcgBracketTable;
      return { targetValue: getBracketUpperBound(indexedBrackets[scenario.filingStatus], constraint.bracketRate) };
    }
  }
}

function evaluateCandidate(
  scenario: Scenario,
  plan: WithdrawalPlan,
  year: number,
  constraint: RothLadderConstraint,
  conversionAmount: number,
): CandidateEvaluation {
  const candidateAmount = roundToCents(Math.max(0, conversionAmount));
  const candidatePlan = setRothConversionForYear(
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

  return {
    conversionAmount: candidateAmount,
    breakdown,
    measuredValue: measureConstraint(constraint, breakdown, taxableIncome),
    taxableIncome,
  };
}

function resultFromEvaluation(
  evaluation: CandidateEvaluation,
  year: number,
  targetValue: number | null,
  status: RothLadderConstraintStatus,
  toleranceDollars: number,
): RothLadderYearResult {
  const bindingMargin = targetValue === null ? null : roundToCents(targetValue - evaluation.measuredValue);

  return {
    year,
    conversionAmount: roundToCents(evaluation.conversionAmount),
    projectedAgi: roundToCents(evaluation.breakdown.agi),
    acaMagi: roundToCents(evaluation.breakdown.acaMagi),
    irmaaMagi: roundToCents(evaluation.breakdown.irmaaMagi),
    taxableIncome: roundToCents(evaluation.taxableIncome),
    bindingMargin,
    constraintMet: bindingMargin !== null && bindingMargin >= -toleranceDollars,
    status,
    targetValue: targetValue === null ? null : roundToCents(targetValue),
    measuredValue: roundToCents(evaluation.measuredValue),
    irmaaLookback: irmaaLookbackForYear(year),
  };
}

function measureConstraint(constraint: RothLadderConstraint, breakdown: YearBreakdown, taxableIncome: number): number {
  switch (constraint.kind) {
    case 'irmaaTier':
      return breakdown.irmaaMagi;
    case 'acaFplPercentage':
      return breakdown.acaMagi;
    case 'federalBracket':
    case 'ltcgBracket':
      return taxableIncome;
  }
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

function computeConversionUpperBound(breakdown: YearBreakdown, maxConversion: number | undefined): UpperBound {
  const availableTraditional = Math.max(0, breakdown.openingBalances.traditional - breakdown.withdrawals.traditional);
  if (maxConversion === undefined) {
    return {
      amount: roundToCents(availableTraditional),
      limitedBy: 'traditional-balance',
    };
  }

  const maxConversionAmount = Math.max(0, maxConversion);
  return {
    amount: roundToCents(Math.min(availableTraditional, maxConversionAmount)),
    limitedBy: maxConversionAmount <= availableTraditional ? 'max-conversion' : 'traditional-balance',
  };
}

function getBracketUpperBound(brackets: readonly Bracket[], bracketRate: number): number | null {
  const bracketIndex = brackets.findIndex((bracket) => Math.abs(bracket.rate - bracketRate) < 1e-10);
  if (bracketIndex === -1) {
    throw new Error(`Bracket rate ${bracketRate} is not available`);
  }

  return brackets[bracketIndex + 1]?.from ?? null;
}

function setRothConversionForYear(plan: WithdrawalPlan, year: number, amount: number): WithdrawalPlan {
  const roundedAmount = roundToCents(Math.max(0, amount));
  const rothConversions = [
    ...(plan.rothConversions ?? []).filter((conversion) => conversion.year !== year),
    ...(roundedAmount > CENT ? [{ year, amount: roundedAmount }] : []),
  ].sort((left, right) => left.year - right.year);

  return {
    ...plan,
    rothConversions,
  };
}

function withoutRothConversionForYear(plan: WithdrawalPlan, year: number): WithdrawalPlan {
  return {
    ...plan,
    rothConversions: (plan.rothConversions ?? []).filter((conversion) => conversion.year !== year),
  };
}

function withoutRothConversionsInRange(plan: WithdrawalPlan, startYear: number, endYear: number): WithdrawalPlan {
  return {
    ...plan,
    rothConversions: (plan.rothConversions ?? []).filter((conversion) => {
      return conversion.year < startYear || conversion.year > endYear;
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

function irmaaLookbackForYear(year: number): RothLadderIrmaaLookbackMetadata {
  const premiumYear = year + 2;
  return {
    magiYear: year,
    premiumYear,
    lookbackYears: 2,
    note: `${year} IRMAA MAGI drives the ${premiumYear} premium bill.`,
  };
}

function normalizeTolerance(toleranceDollars: number | undefined): number {
  if (toleranceDollars === undefined) {
    return ROTH_LADDER_SOLVER_TOLERANCE_DOLLARS;
  }

  return Math.max(CENT, toleranceDollars);
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}
