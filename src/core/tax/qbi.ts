import { CONSTANTS_2026 } from '../constants/2026';
import type { FilingStatus } from '../types';

export type QbiInput = {
  qbiNetIncome: number;
  sstb: boolean;
  taxableIncomeBeforeQbi: number;
  netCapitalGains: number;
  filingStatus: FilingStatus;
  w2WagesAggregated?: number;
  ubiaAggregated?: number;
  phaseouts?: QbiPhaseoutTable;
};

export type QbiPhaseoutTable = Record<FilingStatus, { start: number; end: number }>;

// Simplified Gate 1 scope: the caller supplies already-aggregated QBI, W-2 wages,
// and UBIA. v1 does not model aggregation elections, QBI loss carryovers, patron
// reductions, REIT/PTP components, or separate trade-or-business component math.

// Tax outputs are nonnegative dollar amounts. This helper rounds positive values
// to cents with ROUND_HALF_UP-style behavior and is used only at return boundaries.
function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

function nonnegative(value: number): number {
  return Math.max(0, value);
}

function computeWageUbiaLimit(w2Wages: number, ubia: number): number {
  const qbi = CONSTANTS_2026.qbi;

  return Math.max(w2Wages * qbi.w2WageLimitRate, w2Wages * qbi.w2WageWithUbiaWageRate + ubia * qbi.ubiaLimitRate);
}

export function computeQbi(input: QbiInput): number {
  const qbi = CONSTANTS_2026.qbi;
  const qbiNetIncome = nonnegative(input.qbiNetIncome);
  const taxableIncomeBeforeQbi = nonnegative(input.taxableIncomeBeforeQbi);
  const netCapitalGains = nonnegative(input.netCapitalGains);
  const taxableIncomeLimit = nonnegative(taxableIncomeBeforeQbi - netCapitalGains) * qbi.deductionRate;

  if (qbiNetIncome === 0 || taxableIncomeLimit === 0) {
    return 0;
  }

  const phaseout = (input.phaseouts ?? qbi.phaseouts)[input.filingStatus];
  const baseQbiDeduction = qbiNetIncome * qbi.deductionRate;
  let qbiComponent = baseQbiDeduction;

  if (taxableIncomeBeforeQbi > phaseout.start) {
    if (input.sstb) {
      if (taxableIncomeBeforeQbi >= phaseout.end) {
        qbiComponent = 0;
      } else {
        const phaseoutPercentage = (taxableIncomeBeforeQbi - phaseout.start) / (phaseout.end - phaseout.start);
        qbiComponent = baseQbiDeduction * (1 - phaseoutPercentage);
      }
    } else {
      const w2Wages = nonnegative(input.w2WagesAggregated ?? 0);
      const ubia = nonnegative(input.ubiaAggregated ?? 0);
      qbiComponent = Math.min(baseQbiDeduction, computeWageUbiaLimit(w2Wages, ubia));
    }
  }

  return roundToCents(Math.max(0, Math.min(qbiComponent, taxableIncomeLimit)));
}
