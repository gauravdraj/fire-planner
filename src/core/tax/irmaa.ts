import { CONSTANTS_2026 } from '../constants/2026';
import type { FilingStatus, MagiYear } from '../types';

/*
 * Gate 2 Medicare IRMAA scope: annual premium-year lookup for Part B and Part D
 * income-related monthly adjustment amounts using the encoded 2026 tables. This
 * module does not model life-changing-event appeals, late enrollment penalties,
 * Medicare Advantage Part B reductions, Part D plan premiums, or living-apart
 * exceptions for married filing separately.
 *
 * Sources:
 * - CMS 2026 Medicare Parts A & B Premiums and Deductibles fact sheet,
 *   standard Part B premium and IRMAA amounts, retrieved 2026-04-26,
 *   https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles
 * - SSA POMS HI 01101.020, 2026 IRMAA sliding scale tables and tax-year
 *   lookback fallback, retrieved 2026-04-26,
 *   https://secure.ssa.gov/poms.nsf/lnx/0601101020
 * - SSA POMS HI 01101.031, Part B total premium composition and statutory
 *   citations, retrieved 2026-04-26,
 *   https://secure.ssa.gov/poms.nsf/lnx/0601101031
 * - Social Security Act sections 1839(i) and 1860D-13(a)(7), statutory authority
 *   for Part B and Part D income-related monthly adjustment amounts.
 */

export type IrmaaMagiLookupResult = Readonly<{
  magiUsed: number;
  magiSourceYear: number;
}>;

export type IrmaaTierResult = Readonly<{
  tier: number;
  partBMonthlyAdjustment: number;
  partDMonthlyAdjustment: number;
}>;

export type IrmaaInput = Readonly<{
  premiumYear: number;
  filingStatus: FilingStatus;
  magiHistory: readonly MagiYear[];
}>;

export type IrmaaResult = Readonly<{
  standardPartBPremium: number;
  partBMonthlyAdjustment: number;
  partDMonthlyAdjustment: number;
  annualIrmaaSurcharge: number;
  annualTotal: number;
  tier: number;
  magiUsed: number | undefined;
  magiSourceYear: number | undefined;
}>;

type IrmaaTier = (typeof CONSTANTS_2026.irmaa.partBTiers)[FilingStatus][number];

const MONTHS_PER_YEAR = 12;

// Premium outputs are dollar amounts. Round only at public return boundaries.
function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

function tierMatchesMagi(tier: IrmaaTier, magi: number): boolean {
  if ('magiOver' in tier && tier.magiOver !== null && magi <= tier.magiOver) {
    return false;
  }

  if ('magiUpToInclusive' in tier && magi > tier.magiUpToInclusive) {
    return false;
  }

  if ('magiLessThan' in tier && magi >= tier.magiLessThan) {
    return false;
  }

  if ('magiAtLeast' in tier && magi < tier.magiAtLeast) {
    return false;
  }

  return true;
}

export function lookupIrmaaMagi(
  premiumYear: number,
  magiHistory: readonly MagiYear[],
): IrmaaMagiLookupResult | undefined {
  const primaryYear = premiumYear - CONSTANTS_2026.irmaa.lookbackYears;
  const fallbackYear = primaryYear - 1;
  const primary = magiHistory.find((entry) => entry.year === primaryYear);

  if (primary !== undefined) {
    return {
      magiUsed: primary.magi,
      magiSourceYear: primary.year,
    };
  }

  const fallback = magiHistory.find((entry) => entry.year === fallbackYear);
  if (fallback === undefined) {
    return undefined;
  }

  return {
    magiUsed: fallback.magi,
    magiSourceYear: fallback.year,
  };
}

export function lookupIrmaaTier(filingStatus: FilingStatus, magi: number): IrmaaTierResult {
  const tiers = CONSTANTS_2026.irmaa.partBTiers[filingStatus];

  for (const [tierIndex, tier] of tiers.entries()) {
    if (tierMatchesMagi(tier, magi)) {
      return {
        tier: tierIndex,
        partBMonthlyAdjustment: roundToCents(tier.partBMonthlyAdjustment),
        partDMonthlyAdjustment: roundToCents(tier.partDMonthlyAdjustment),
      };
    }
  }

  throw new Error(`No IRMAA tier matched ${filingStatus} MAGI ${magi}`);
}

export function computeIrmaa(input: IrmaaInput): IrmaaResult {
  const magiLookup = lookupIrmaaMagi(input.premiumYear, input.magiHistory);
  const standardPartBPremium = roundToCents(CONSTANTS_2026.irmaa.standardPartBPremium);

  if (magiLookup === undefined) {
    return {
      standardPartBPremium,
      partBMonthlyAdjustment: 0,
      partDMonthlyAdjustment: 0,
      annualIrmaaSurcharge: 0,
      annualTotal: roundToCents(standardPartBPremium * MONTHS_PER_YEAR),
      tier: 0,
      magiUsed: undefined,
      magiSourceYear: undefined,
    };
  }

  const tier = lookupIrmaaTier(input.filingStatus, magiLookup.magiUsed);
  const annualIrmaaSurcharge = roundToCents(
    (tier.partBMonthlyAdjustment + tier.partDMonthlyAdjustment) * MONTHS_PER_YEAR,
  );
  const annualTotal = roundToCents(
    (standardPartBPremium + tier.partBMonthlyAdjustment + tier.partDMonthlyAdjustment) * MONTHS_PER_YEAR,
  );

  return {
    standardPartBPremium,
    partBMonthlyAdjustment: tier.partBMonthlyAdjustment,
    partDMonthlyAdjustment: tier.partDMonthlyAdjustment,
    annualIrmaaSurcharge,
    annualTotal,
    tier: tier.tier,
    magiUsed: magiLookup.magiUsed,
    magiSourceYear: magiLookup.magiSourceYear,
  };
}
