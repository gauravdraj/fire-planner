import type { AccountBalances, YearBreakdown } from './projection';

const SUPPORTED_BALANCE_KEYS = ['cash', 'taxableBrokerage', 'traditional', 'roth'] as const;

export type ProjectionMetricFormValues = Readonly<{
  currentYear: number;
  primaryAge: number;
  retirementYear: number;
  annualSocialSecurityBenefit: number;
  socialSecurityClaimAge: number;
}>;

export type BalanceMetric = Readonly<{
  amount: number;
  year: number;
}>;

export type YearsFundedMetric = Readonly<{
  count: number;
  depletedYear: number | null;
  fundedThroughYear: number | null;
}>;

export type BridgeWindowReason = 'medicare' | 'socialSecurity' | 'tenYearFallback';

export type BridgeWindow = Readonly<{
  startYear: number;
  endYear: number;
  reason: BridgeWindowReason;
  years: readonly YearBreakdown[];
}>;

export function computeNetWorthAtRetirement(
  projectionResults: readonly YearBreakdown[],
  retirementYear: number,
): BalanceMetric | null {
  const retirementBreakdown = projectionResults.find((breakdown) => breakdown.year === retirementYear) ?? null;

  return retirementBreakdown === null
    ? null
    : {
        amount: sumSupportedBalances(retirementBreakdown.openingBalances),
        year: retirementBreakdown.year,
      };
}

export function computePlanEndBalance(projectionResults: readonly YearBreakdown[]): BalanceMetric | null {
  const finalBreakdown = projectionResults.at(-1) ?? null;

  return finalBreakdown === null
    ? null
    : {
        amount: sumSupportedBalances(finalBreakdown.closingBalances),
        year: finalBreakdown.year,
      };
}

export function computeYearsFundedFromRetirement(
  projectionResults: readonly YearBreakdown[],
  retirementYear: number,
): YearsFundedMetric {
  let count = 0;
  let expectedYear = retirementYear;
  let fundedThroughYear: number | null = null;

  for (const breakdown of projectionResults) {
    if (breakdown.year < retirementYear) {
      continue;
    }

    if (breakdown.year !== expectedYear) {
      break;
    }

    count += 1;
    fundedThroughYear = breakdown.year;

    if (sumSupportedBalances(breakdown.closingBalances) <= 0) {
      return {
        count,
        depletedYear: breakdown.year,
        fundedThroughYear,
      };
    }

    expectedYear += 1;
  }

  return {
    count,
    depletedYear: null,
    fundedThroughYear,
  };
}

export function selectBridgeWindow(
  formValues: ProjectionMetricFormValues,
  projectionResults: readonly YearBreakdown[],
): BridgeWindow {
  const startYear = formValues.retirementYear;
  const medicareEligibilityYear = formValues.currentYear + (65 - formValues.primaryAge);
  const socialSecurityClaimYear = formValues.currentYear + (formValues.socialSecurityClaimAge - formValues.primaryAge);
  const { endYear, reason } = selectBridgeWindowEndYear({
    medicareEligibilityYear,
    retirementYear: startYear,
    socialSecurityAnnualBenefit: formValues.annualSocialSecurityBenefit,
    socialSecurityClaimYear,
  });

  return {
    startYear,
    endYear,
    reason,
    years: projectionResults.filter((breakdown) => breakdown.year >= startYear && breakdown.year <= endYear),
  };
}

export function computeAverageBridgeAcaMagi(bridgeYears: readonly YearBreakdown[]): number | null {
  if (bridgeYears.length === 0) {
    return null;
  }

  return sumBy(bridgeYears, (breakdown) => breakdown.acaMagi) / bridgeYears.length;
}

export function computeMaxBridgeGrossBucketDrawPercentage(bridgeYears: readonly YearBreakdown[]): number | null {
  if (bridgeYears.length === 0) {
    return null;
  }

  return Math.max(
    ...bridgeYears.map((breakdown) => {
      const openingBalance = sumSupportedBalances(breakdown.openingBalances);

      return openingBalance <= 0 ? 0 : sumSupportedBalances(breakdown.withdrawals) / openingBalance;
    }),
  );
}

export function computeTotalBridgeTax(bridgeYears: readonly YearBreakdown[]): number | null {
  if (bridgeYears.length === 0) {
    return null;
  }

  return roundToCents(sumBy(bridgeYears, (breakdown) => breakdown.totalTax));
}

function selectBridgeWindowEndYear({
  medicareEligibilityYear,
  retirementYear,
  socialSecurityAnnualBenefit,
  socialSecurityClaimYear,
}: {
  medicareEligibilityYear: number;
  retirementYear: number;
  socialSecurityAnnualBenefit: number;
  socialSecurityClaimYear: number;
}): { endYear: number; reason: BridgeWindowReason } {
  /*
   * Bridge metrics prioritize the pre-Medicare span, then the pre-Social
   * Security span when a benefit is modeled, then ten retirement years.
   */
  if (medicareEligibilityYear > retirementYear) {
    return {
      endYear: medicareEligibilityYear - 1,
      reason: 'medicare',
    };
  }

  if (socialSecurityAnnualBenefit > 0 && socialSecurityClaimYear > retirementYear) {
    return {
      endYear: socialSecurityClaimYear - 1,
      reason: 'socialSecurity',
    };
  }

  return {
    endYear: retirementYear + 9,
    reason: 'tenYearFallback',
  };
}

function sumSupportedBalances(balances: AccountBalances): number {
  return SUPPORTED_BALANCE_KEYS.reduce((total, key) => total + balances[key], 0);
}

function sumBy<TValue>(values: readonly TValue[], getValue: (value: TValue) => number): number {
  return values.reduce((total, value) => total + getValue(value), 0);
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}
