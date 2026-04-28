import { runProjection, type Scenario, type WithdrawalPlan, type YearBreakdown } from './projection';

export type BalanceYearResult = Readonly<{
  year: number;
  brokerageWithdrawal: number;
  resultingCashflow: number;
  iterations: number;
  converged: boolean;
}>;

export type BalanceYearOptions = Readonly<{
  tolerance?: number;
  maxIterations?: number;
}>;

type CandidateEvaluation = Readonly<{
  candidate: number;
  brokerageWithdrawal: number;
  resultingCashflow: number;
}>;

type Bracket = Readonly<{
  low: CandidateEvaluation;
  high: CandidateEvaluation;
}>;

const DEFAULT_TOLERANCE = 10;
const DEFAULT_MAX_ITERATIONS = 50;
const SCAN_SEGMENTS = 12;
const MIN_SEARCH_UPPER_BOUND = 10_000;

export function balanceYearToZero(
  year: number,
  scenario: Scenario,
  plan: WithdrawalPlan,
  options: BalanceYearOptions = {},
): BalanceYearResult {
  const tolerance = normalizePositiveNumber(options.tolerance, DEFAULT_TOLERANCE);
  const maxIterations = normalizePositiveInteger(options.maxIterations, DEFAULT_MAX_ITERATIONS);
  const workingPlan = withProjectionEndYear(plan, year);
  const baseline = projectionYear(scenario, workingPlan, year);
  const baselineSpending = annualSpendingForYear(workingPlan, year);
  let iterations = 0;
  let best: CandidateEvaluation = {
    candidate: 0,
    brokerageWithdrawal: 0,
    resultingCashflow: baseline.afterTaxCashFlow,
  };

  if (Math.abs(best.resultingCashflow) <= tolerance) {
    return resultFromEvaluation(year, best, iterations, true);
  }

  const upperBound = computeSearchUpperBound(baseline);
  const scanSegments = Math.min(SCAN_SEGMENTS, maxIterations);
  let previous = best;
  let bestBracket: Bracket | null = null;

  for (let segment = 1; segment <= scanSegments; segment += 1) {
    const candidate = roundToCents((upperBound * segment) / scanSegments);
    const evaluation = evaluateCandidate(scenario, workingPlan, year, baseline, baselineSpending, candidate);
    iterations += 1;
    best = betterEvaluation(best, evaluation);

    if (Math.abs(best.resultingCashflow) <= tolerance) {
      return resultFromEvaluation(year, best, iterations, true);
    }

    if (hasSignChange(previous.resultingCashflow, evaluation.resultingCashflow)) {
      const bracket = orderedBracket(previous, evaluation);
      bestBracket = betterBracket(bestBracket, bracket);
    }

    previous = evaluation;
  }

  if (bestBracket === null) {
    return resultFromEvaluation(year, best, iterations, false);
  }

  let low = bestBracket.low;
  let high = bestBracket.high;

  while (iterations < maxIterations) {
    const midpoint = roundToCents((low.candidate + high.candidate) / 2);
    if (midpoint === low.candidate || midpoint === high.candidate) {
      break;
    }

    const evaluation = evaluateCandidate(scenario, workingPlan, year, baseline, baselineSpending, midpoint);
    iterations += 1;
    best = betterEvaluation(best, evaluation);

    if (Math.abs(evaluation.resultingCashflow) <= tolerance) {
      return resultFromEvaluation(year, evaluation, iterations, true);
    }

    if (hasSignChange(low.resultingCashflow, evaluation.resultingCashflow)) {
      high = evaluation;
    } else {
      low = evaluation;
    }
  }

  return resultFromEvaluation(year, best, iterations, Math.abs(best.resultingCashflow) <= tolerance);
}

function evaluateCandidate(
  scenario: Scenario,
  plan: WithdrawalPlan,
  year: number,
  baseline: YearBreakdown,
  baselineSpending: number,
  candidate: number,
): CandidateEvaluation {
  const candidatePlan = setAnnualSpendingForYear(plan, year, roundToCents(baselineSpending + Math.max(0, candidate)));
  const breakdown = projectionYear(scenario, candidatePlan, year);

  return {
    candidate: roundToCents(Math.max(0, candidate)),
    brokerageWithdrawal: roundToCents(
      breakdown.withdrawals.taxableBrokerage - baseline.withdrawals.taxableBrokerage,
    ),
    resultingCashflow: roundToCents(breakdown.afterTaxCashFlow),
  };
}

function projectionYear(scenario: Scenario, plan: WithdrawalPlan, year: number): YearBreakdown {
  const breakdown = runProjection(scenario, plan).find((candidateYear) => candidateYear.year === year);

  if (breakdown === undefined) {
    throw new Error(`Projection did not return target year ${year}`);
  }

  return breakdown;
}

function withProjectionEndYear(plan: WithdrawalPlan, year: number): WithdrawalPlan {
  return {
    ...plan,
    endYear: Math.max(plan.endYear, year),
    annualSpending: [...plan.annualSpending],
    ...(plan.rothConversions !== undefined ? { rothConversions: [...plan.rothConversions] } : {}),
    ...(plan.brokerageHarvests !== undefined ? { brokerageHarvests: [...plan.brokerageHarvests] } : {}),
  };
}

function annualSpendingForYear(plan: WithdrawalPlan, year: number): number {
  return roundToCents(plan.annualSpending.reduce((sum, entry) => sum + (entry.year === year ? entry.amount : 0), 0));
}

function setAnnualSpendingForYear(plan: WithdrawalPlan, year: number, amount: number): WithdrawalPlan {
  const annualSpending = plan.annualSpending.filter((entry) => entry.year !== year);
  const roundedAmount = roundToCents(Math.max(0, amount));

  if (roundedAmount > 0) {
    annualSpending.push({ year, amount: roundedAmount });
  }

  return {
    ...plan,
    annualSpending,
  };
}

function computeSearchUpperBound(baseline: YearBreakdown): number {
  /*
   * Probes use annualSpending as the only available withdrawal knob. The range is
   * anchored to the target year's projected cash need, where YearBreakdown.spending
   * already includes mortgage P&I, and has a floor so zero-spending years still
   * leave room to discover tax-only cash-flow shortfalls.
   */
  return roundToCents(Math.max(baseline.spending + Math.abs(Math.min(0, baseline.afterTaxCashFlow)), MIN_SEARCH_UPPER_BOUND));
}

function betterEvaluation(current: CandidateEvaluation, candidate: CandidateEvaluation): CandidateEvaluation {
  if (Math.abs(candidate.resultingCashflow) < Math.abs(current.resultingCashflow)) {
    return candidate;
  }

  return current;
}

function betterBracket(current: Bracket | null, candidate: Bracket): Bracket {
  if (current === null) {
    return candidate;
  }

  const currentScore = Math.min(Math.abs(current.low.resultingCashflow), Math.abs(current.high.resultingCashflow));
  const candidateScore = Math.min(Math.abs(candidate.low.resultingCashflow), Math.abs(candidate.high.resultingCashflow));

  return candidateScore < currentScore ? candidate : current;
}

function orderedBracket(first: CandidateEvaluation, second: CandidateEvaluation): Bracket {
  return first.candidate <= second.candidate ? { low: first, high: second } : { low: second, high: first };
}

function hasSignChange(left: number, right: number): boolean {
  return (left <= 0 && right >= 0) || (left >= 0 && right <= 0);
}

function resultFromEvaluation(
  year: number,
  evaluation: CandidateEvaluation,
  iterations: number,
  converged: boolean,
): BalanceYearResult {
  return {
    year,
    brokerageWithdrawal: roundToCents(evaluation.brokerageWithdrawal),
    resultingCashflow: roundToCents(evaluation.resultingCashflow),
    iterations,
    converged,
  };
}

function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}
