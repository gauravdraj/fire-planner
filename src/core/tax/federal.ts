import { CONSTANTS_2026 } from '../constants/2026';
import type { BracketTable, FilingStatus } from '../types';

// Tax outputs are nonnegative dollar amounts. This helper rounds positive values
// to cents with ROUND_HALF_UP-style behavior and is used only at return boundaries.
function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

export function computeFederalTax(taxableIncome: number, filingStatus: FilingStatus, brackets: BracketTable): number {
  const income = Math.max(0, taxableIncome);
  const statusBrackets = brackets[filingStatus];
  let tax = 0;

  for (let index = 0; index < statusBrackets.length; index += 1) {
    const bracket = statusBrackets[index];
    if (bracket === undefined) {
      continue;
    }

    const nextBracketStart = statusBrackets[index + 1]?.from ?? Number.POSITIVE_INFINITY;
    if (income <= bracket.from) {
      break;
    }

    tax += (Math.min(income, nextBracketStart) - bracket.from) * bracket.rate;

    if (income <= nextBracketStart) {
      break;
    }
  }

  return roundToCents(tax);
}

export function computeTaxableIncome(
  agi: number,
  filingStatus: FilingStatus,
  options: { age65Plus?: boolean; partnerAge65Plus?: boolean; magi?: number } = {},
): number {
  const standardDeduction = CONSTANTS_2026.federal.standardDeduction[filingStatus];
  const seniorDeduction = computeSeniorDeduction(agi, filingStatus, options);

  return roundToCents(Math.max(0, agi - standardDeduction - seniorDeduction));
}

function computeSeniorDeduction(
  agi: number,
  filingStatus: FilingStatus,
  options: { age65Plus?: boolean; partnerAge65Plus?: boolean; magi?: number },
): number {
  const seniorDeduction = CONSTANTS_2026.federal.seniorDeduction;
  if (!seniorDeduction.eligibleFilingStatuses[filingStatus]) {
    return 0;
  }

  const qualifiedIndividuals = Math.min(
    Number(options.age65Plus === true) + Number(filingStatus === 'mfj' && options.partnerAge65Plus === true),
    seniorDeduction.maxQualifiedIndividuals[filingStatus],
  );
  if (qualifiedIndividuals === 0) {
    return 0;
  }

  const phaseoutThreshold = seniorDeduction.magiPhaseout.thresholds[filingStatus];
  if (phaseoutThreshold === null) {
    return 0;
  }

  const magi = options.magi ?? agi;
  const reductionPerPerson = Math.max(0, magi - phaseoutThreshold) * seniorDeduction.magiPhaseout.rate;
  const deductionPerPerson = Math.max(0, seniorDeduction.perQualifiedIndividual - reductionPerPerson);

  return deductionPerPerson * qualifiedIndividuals;
}
