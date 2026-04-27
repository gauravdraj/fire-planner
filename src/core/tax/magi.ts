/*
 * ACA premium tax credit MAGI and Medicare IRMAA MAGI are not the same
 * add-back definition. IRC 36B(d)(2)(B) defines ACA MAGI as AGI plus tax-exempt
 * interest, foreign earned income/housing amounts excluded under IRC 911, and
 * Social Security benefits excluded from gross income under IRC 86. Medicare
 * IRMAA uses modified AGI as AGI plus tax-exempt interest for Part B and Part D
 * income-related monthly adjustment amounts. This Gate 1 module only computes
 * the income definitions; ACA credits, IRMAA tier lookup, two-year lag behavior,
 * and projection logic are out of scope.
 *
 * Sources:
 * - 26 U.S.C. 36B(d)(2)(B), premium tax credit modified adjusted gross income,
 *   https://uscode.house.gov/view.xhtml?req=(title:26%20section:36B%20edition:prelim)
 * - IRS Instructions for Form 8962 (2025), "Modified AGI",
 *   https://www.irs.gov/instructions/i8962
 * - 42 U.S.C. 1395r(i)(4), Medicare Part B income-related monthly adjustment
 *   amount modified adjusted gross income definition,
 *   https://uscode.house.gov/view.xhtml?req=(title:42%20section:1395r%20edition:prelim)
 */

export type AboveTheLineDeductions = {
  traditionalIra?: number;
  hsa?: number;
  studentLoanInterest?: number;
  selfEmployedHealthInsurance?: number;
  otherSupported?: number;
};

export type AgiInput = {
  wages?: number;
  netSelfEmploymentIncome?: number;
  pensions?: number;
  taxableSocialSecurity?: number;
  iraDistributions?: number;
  rothConversions?: number;
  taxableBrokerageIncome?: number;
  capitalGains?: number;
  rentalNetIncome?: number;
  otherIncome?: number;
  seDeductibleHalf?: number;
  aboveTheLineDeductions?: AboveTheLineDeductions;
};

export type AcaMagiInput = {
  agi: number;
  taxExemptInterest?: number;
  nonTaxableSocialSecurityBenefits?: number;
  foreignEarnedIncomeExclusion?: number;
};

export type IrmaaMagiInput = {
  agi: number;
  taxExemptInterest?: number;
};

// Tax outputs are dollar amounts. This helper rounds positive and negative
// values to cents with ROUND_HALF_UP-style behavior at return boundaries.
function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

function valueOrZero(value: number | undefined): number {
  return value ?? 0;
}

function nonnegative(value: number | undefined): number {
  return Math.max(0, valueOrZero(value));
}

export function computeAgi(input: AgiInput): number {
  const grossIncome =
    valueOrZero(input.wages) +
    valueOrZero(input.netSelfEmploymentIncome) +
    valueOrZero(input.pensions) +
    valueOrZero(input.taxableSocialSecurity) +
    valueOrZero(input.iraDistributions) +
    valueOrZero(input.rothConversions) +
    valueOrZero(input.taxableBrokerageIncome) +
    valueOrZero(input.capitalGains) +
    valueOrZero(input.rentalNetIncome) +
    valueOrZero(input.otherIncome);

  const deductions = input.aboveTheLineDeductions;
  const aboveTheLineDeductions =
    nonnegative(input.seDeductibleHalf) +
    nonnegative(deductions?.traditionalIra) +
    nonnegative(deductions?.hsa) +
    nonnegative(deductions?.studentLoanInterest) +
    nonnegative(deductions?.selfEmployedHealthInsurance) +
    nonnegative(deductions?.otherSupported);

  return roundToCents(grossIncome - aboveTheLineDeductions);
}

export function computeMagiAca(input: AcaMagiInput): number {
  return roundToCents(
    input.agi +
      nonnegative(input.taxExemptInterest) +
      nonnegative(input.nonTaxableSocialSecurityBenefits) +
      nonnegative(input.foreignEarnedIncomeExclusion),
  );
}

export function computeMagiIrmaa(input: IrmaaMagiInput): number {
  return roundToCents(input.agi + nonnegative(input.taxExemptInterest));
}
