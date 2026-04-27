import { CONSTANTS_2026 } from '../constants/2026';
import { indexFplTableForYear } from '../projection';

/*
 * Gate 2 ACA premium tax credit scope: Form 8962-style annual credit math for
 * household MAGI, published FPL guidelines, SLCSP benchmark premiums, and APTC
 * reconciliation. This module does not model Marketplace enrollment rules,
 * affordability safe harbors, Medicaid expansion gaps, or monthly eligibility
 * changes.
 *
 * Sources:
 * - 26 U.S.C. § 36B, premium assistance credit amount, household income,
 *   applicable percentage, and reconciliation, retrieved 2026-04-26,
 *   https://uscode.house.gov/view.xhtml?req=(title:26%20section:36B%20edition:prelim)
 * - IRS Instructions for Form 8962 (2025), premium tax credit and advance
 *   payment reconciliation worksheets, retrieved 2026-04-26,
 *   https://www.irs.gov/instructions/i8962
 * - IRS Rev. Proc. 2025-25, 2026 ACA applicable percentage table,
 *   retrieved 2026-04-26,
 *   https://www.irs.gov/pub/irs-drop/rp-25-25.pdf
 * - HHS 2025 Poverty Guidelines, 90 FR 5917, used for 2026 PTC coverage-year
 *   calculations under the prior-year FPL rule, retrieved 2026-04-26,
 *   https://www.federalregister.gov/documents/2025/01/17/2025-01377/annual-update-of-the-hhs-poverty-guidelines
 */

export type FplRegion = 'contiguous' | 'alaska' | 'hawaii';

export type FplHouseholdSizeTable = Readonly<{
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  7: number;
  8: number;
}>;

export type FplRegionTable = Readonly<{
  householdSize: FplHouseholdSizeTable;
  additionalPerPerson: number;
}>;

export type FplTable = Readonly<{
  year: number;
  source: string;
  retrievedAt: string;
  contiguous: FplRegionTable;
  alaska: FplRegionTable;
  hawaii: FplRegionTable;
  indexedFromYear?: number;
  indexingRate?: number;
}>;

export type GetFplForCoverageYearInput = Readonly<{
  coverageYear: number;
  /**
   * Coverage year N uses FPL year N - 1. If that prior-year FPL table is not
   * published in CONSTANTS_2026, the projection layer should pass its scenario
   * inflation rate here; this function indexes the latest published FPL table
   * forward, returns a copy, and never mutates the sealed source constants.
   */
  fplIndexingRate?: number;
}>;

export type RequiredContributionInput = Readonly<{
  householdIncome: number;
  applicablePercentage: number;
}>;

export type PremiumTaxCreditInput = Readonly<{
  coverageYear: number;
  householdIncome: number;
  householdSize: number;
  annualBenchmarkPremium: number;
  annualEnrollmentPremium?: number;
  region?: FplRegion;
  fplIndexingRate?: number;
}>;

export type PremiumTaxCreditResult = Readonly<{
  premiumTaxCredit: number;
  fplPercent: number;
  applicablePercentage: number;
  requiredContribution: number;
  isEligible: boolean;
}>;

export type AptcReconciliationInput = Readonly<{
  coverageYear: number;
  allowedPremiumTaxCredit: number;
  advancePremiumTaxCredit: number;
}>;

export type AptcReconciliationResult = Readonly<{
  allowedPremiumTaxCredit: number;
  advancePremiumTaxCredit: number;
  netPremiumTaxCredit: number;
  excessAdvancePremiumTaxCredit: number;
  repaymentAmount: number;
  repaymentCap: number | null;
  isRepaymentCapped: boolean;
}>;

type ApplicablePercentageBand = (typeof CONSTANTS_2026.aca.applicablePercentages)[number];

const FPL_REGIONS = ['contiguous', 'alaska', 'hawaii'] as const;
const LATEST_PUBLISHED_FPL_TABLE: FplTable = CONSTANTS_2026.fpl;
const EARLIEST_SUPPORTED_COVERAGE_YEAR = CONSTANTS_2026.fpl2025.year + 1;
const MAX_PTC_FPL_PERCENT = 4;

// Tax outputs are dollar amounts. This helper rounds positive and negative
// values to cents with ROUND_HALF_UP-style behavior at return boundaries.
function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

function nonnegative(value: number): number {
  return Math.max(0, value);
}

function getApplicableBand(fplPercent: number): ApplicablePercentageBand {
  const bands = CONSTANTS_2026.aca.applicablePercentages;
  const lastBand = bands.at(-1);

  if (lastBand === undefined) {
    throw new Error('ACA applicable percentage table is empty');
  }

  for (const band of bands) {
    const isLastBand = band === lastBand;
    if (fplPercent >= band.fplFrom && (fplPercent < band.fplTo || isLastBand)) {
      return band;
    }
  }

  return fplPercent < bands[0].fplFrom ? bands[0] : lastBand;
}

function getPovertyGuideline(table: FplTable, householdSize: number, region: FplRegion): number {
  if (!Number.isInteger(householdSize) || householdSize < 1) {
    throw new Error('ACA householdSize must be a positive integer');
  }

  const regionTable = table[region];
  if (householdSize <= 8) {
    return regionTable.householdSize[householdSize as keyof FplHouseholdSizeTable];
  }

  return regionTable.householdSize[8] + (householdSize - 8) * regionTable.additionalPerPerson;
}

export function getFPLForCoverageYear(input: number | GetFplForCoverageYearInput): FplTable {
  const coverageYear = typeof input === 'number' ? input : input.coverageYear;
  const fplIndexingRate = typeof input === 'number' ? 0 : (input.fplIndexingRate ?? 0);
  const fplYear = coverageYear - 1;

  if (coverageYear < EARLIEST_SUPPORTED_COVERAGE_YEAR) {
    throw new Error('ACA FPL tables before coverage year 2026 are not encoded');
  }

  if (fplYear === CONSTANTS_2026.fpl2025.year) {
    return CONSTANTS_2026.fpl2025;
  }

  if (fplYear === CONSTANTS_2026.fpl.year) {
    return CONSTANTS_2026.fpl;
  }

  return indexFplTableForYear(LATEST_PUBLISHED_FPL_TABLE, fplYear, fplIndexingRate);
}

export function computeApplicablePercentage(fplPercent: number): number {
  const boundedFplPercent = nonnegative(fplPercent);
  const band = getApplicableBand(boundedFplPercent);

  if (band.fplTo === band.fplFrom) {
    return band.final;
  }

  const bandPosition = Math.min(1, Math.max(0, (boundedFplPercent - band.fplFrom) / (band.fplTo - band.fplFrom)));

  return band.initial + (band.final - band.initial) * bandPosition;
}

export function computeRequiredContribution(input: RequiredContributionInput): number {
  return roundToCents(nonnegative(input.householdIncome) * nonnegative(input.applicablePercentage));
}

export function computePremiumTaxCredit(input: PremiumTaxCreditInput): PremiumTaxCreditResult {
  const region = input.region ?? 'contiguous';
  if (!FPL_REGIONS.includes(region)) {
    throw new Error('ACA region must be contiguous, alaska, or hawaii');
  }

  const householdIncome = nonnegative(input.householdIncome);
  const fplTable =
    input.fplIndexingRate === undefined
      ? getFPLForCoverageYear(input.coverageYear)
      : getFPLForCoverageYear({
          coverageYear: input.coverageYear,
          fplIndexingRate: input.fplIndexingRate,
        });
  const povertyGuideline = getPovertyGuideline(fplTable, input.householdSize, region);
  const fplPercent = povertyGuideline === 0 ? 0 : householdIncome / povertyGuideline;
  const isEligible = fplPercent >= 1 && fplPercent <= MAX_PTC_FPL_PERCENT;
  const applicablePercentage = isEligible ? computeApplicablePercentage(fplPercent) : 0;
  const requiredContribution = isEligible
    ? computeRequiredContribution({ householdIncome, applicablePercentage })
    : 0;
  const allowedBeforeEnrollmentCap = Math.max(0, nonnegative(input.annualBenchmarkPremium) - requiredContribution);
  const annualEnrollmentPremium = nonnegative(input.annualEnrollmentPremium ?? input.annualBenchmarkPremium);
  const premiumTaxCredit = isEligible ? Math.min(annualEnrollmentPremium, allowedBeforeEnrollmentCap) : 0;

  return {
    premiumTaxCredit: roundToCents(premiumTaxCredit),
    fplPercent,
    applicablePercentage,
    requiredContribution,
    isEligible,
  };
}

export function computeAptcReconciliation(input: AptcReconciliationInput): AptcReconciliationResult {
  if (input.coverageYear < 2026) {
    throw new Error('Pre-2026 APTC repayment caps are not encoded');
  }

  const allowedPremiumTaxCredit = nonnegative(input.allowedPremiumTaxCredit);
  const advancePremiumTaxCredit = nonnegative(input.advancePremiumTaxCredit);
  const netPremiumTaxCredit = Math.max(0, allowedPremiumTaxCredit - advancePremiumTaxCredit);
  const excessAdvancePremiumTaxCredit = Math.max(0, advancePremiumTaxCredit - allowedPremiumTaxCredit);

  return {
    allowedPremiumTaxCredit: roundToCents(allowedPremiumTaxCredit),
    advancePremiumTaxCredit: roundToCents(advancePremiumTaxCredit),
    netPremiumTaxCredit: roundToCents(netPremiumTaxCredit),
    excessAdvancePremiumTaxCredit: roundToCents(excessAdvancePremiumTaxCredit),
    // OBBBA post-2025 rule: excess APTC is fully repayable; no statutory cap is applied.
    repaymentAmount: roundToCents(excessAdvancePremiumTaxCredit),
    repaymentCap: null,
    isRepaymentCapped: false,
  };
}
