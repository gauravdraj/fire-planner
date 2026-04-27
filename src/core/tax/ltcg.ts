import { CONSTANTS_2026 } from '../constants/2026';
import type { FilingStatus, LtcgBracketTable } from '../types';

export type LtcgTaxInput = {
  ordinaryTaxableIncome: number;
  ltcgAndQdiv: number;
  filingStatus: FilingStatus;
  brackets?: LtcgBracketTable;
};

export type LtcgBracketBreakdown = {
  from: number;
  to: number | null;
  rate: number;
  taxableAmount: number;
  tax: number;
};

export type LtcgTaxResult = {
  ltcgTax: number;
  bracketBreakdown: LtcgBracketBreakdown[];
};

// Tax outputs are nonnegative dollar amounts. This helper rounds positive values
// to cents with ROUND_HALF_UP-style behavior and is used only at return boundaries.
function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

export function computeLtcgTax(input: LtcgTaxInput): LtcgTaxResult {
  const ordinaryTaxableIncome = Math.max(0, input.ordinaryTaxableIncome);
  const ltcgAndQdiv = Math.max(0, input.ltcgAndQdiv);
  const totalIncomeWithPreferentialIncome = ordinaryTaxableIncome + ltcgAndQdiv;
  const brackets = (input.brackets ?? CONSTANTS_2026.ltcg.brackets)[input.filingStatus];
  let ltcgTax = 0;

  const bracketBreakdown = brackets.map((bracket, index): LtcgBracketBreakdown => {
    const nextBracketStart = brackets[index + 1]?.from ?? Number.POSITIVE_INFINITY;
    const taxableAmount = Math.max(
      0,
      Math.min(totalIncomeWithPreferentialIncome, nextBracketStart) - Math.max(ordinaryTaxableIncome, bracket.from),
    );
    const tax = taxableAmount * bracket.rate;
    ltcgTax += tax;

    return {
      from: bracket.from,
      to: Number.isFinite(nextBracketStart) ? nextBracketStart : null,
      rate: bracket.rate,
      taxableAmount: roundToCents(taxableAmount),
      tax: roundToCents(tax),
    };
  });

  return {
    ltcgTax: roundToCents(ltcgTax),
    bracketBreakdown,
  };
}
