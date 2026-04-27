import type { FilingStatus } from '../types';

/*
 * Gate 2 starter state-tax scope: annual resident taxable-income tax for three
 * law shapes needed by the projection engine: no individual income tax, one
 * flat rate, and published bracket-formula schedules. This module does not
 * model state deductions, credits, locality taxes, withholding, part-year or
 * nonresident allocation, AMT, or California's separate Behavioral Health
 * Services Tax.
 */

export type StateLawBase = Readonly<{
  stateCode: string;
  stateName: string;
  taxYear: number;
  source: string;
  retrievedAt: string;
}>;

export type NoIncomeTaxStateLaw = StateLawBase &
  Readonly<{
    kind: 'none';
  }>;

export type FlatStateTaxLaw = StateLawBase &
  Readonly<{
    kind: 'flat';
    rate: number;
  }>;

export type StateTaxBracket = Readonly<{
  from: number;
  upTo?: number;
  baseTax: number;
  rate: number;
}>;

export type StateBracketTable = Readonly<Record<FilingStatus, readonly StateTaxBracket[]>>;

export type BracketedStateTaxLaw = StateLawBase &
  Readonly<{
    kind: 'bracketed';
    brackets: StateBracketTable;
  }>;

export type StateIncomeTaxLaw = NoIncomeTaxStateLaw | FlatStateTaxLaw | BracketedStateTaxLaw;

export type StateTaxInput = Readonly<{
  taxableIncome: number;
  filingStatus: FilingStatus;
  law: StateIncomeTaxLaw;
}>;

// State tax outputs are dollar amounts. Round only at the public return boundary.
function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

function nonnegative(value: number): number {
  return Math.max(0, value);
}

function computeBracketedStateTax(
  taxableIncome: number,
  filingStatus: FilingStatus,
  brackets: StateBracketTable,
): number {
  const statusBrackets = brackets[filingStatus];

  for (const bracket of statusBrackets) {
    if (taxableIncome <= bracket.from) {
      continue;
    }

    if (bracket.upTo === undefined || taxableIncome <= bracket.upTo) {
      return bracket.baseTax + (taxableIncome - bracket.from) * bracket.rate;
    }
  }

  throw new Error(`No state tax bracket matched ${filingStatus} taxable income ${taxableIncome}`);
}

export function computeStateTax(input: StateTaxInput): number {
  const taxableIncome = nonnegative(input.taxableIncome);

  if (taxableIncome === 0) {
    return 0;
  }

  if (input.law.kind === 'none') {
    return 0;
  }

  if (input.law.kind === 'flat') {
    return roundToCents(taxableIncome * input.law.rate);
  }

  return roundToCents(computeBracketedStateTax(taxableIncome, input.filingStatus, input.law.brackets));
}
