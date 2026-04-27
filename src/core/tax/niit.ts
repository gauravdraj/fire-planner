import { CONSTANTS_2026 } from '../constants/2026';
import type { FilingStatus } from '../types';

export type NiitInput = {
  magiForNiit: number;
  netInvestmentIncome: number;
  filingStatus: FilingStatus;
  rate?: number;
};

// Tax outputs are nonnegative dollar amounts. This helper rounds positive values
// to cents with ROUND_HALF_UP-style behavior and is used only at return boundaries.
function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

export function computeNiit(input: NiitInput): number {
  const threshold = CONSTANTS_2026.niit.magiThresholds[input.filingStatus];
  const excessMagi = Math.max(0, input.magiForNiit - threshold);
  const taxableNetInvestmentIncome = Math.min(Math.max(0, input.netInvestmentIncome), excessMagi);

  return roundToCents(taxableNetInvestmentIncome * (input.rate ?? CONSTANTS_2026.niit.rate));
}
