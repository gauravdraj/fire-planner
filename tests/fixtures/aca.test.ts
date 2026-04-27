import { describe, expect, it } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import {
  computeApplicablePercentage,
  computeAptcReconciliation,
  computePremiumTaxCredit,
  computeRequiredContribution,
  getFPLForCoverageYear,
} from '@/core/tax/aca';

const HHS_FPL_2025 =
  'HHS 2025 Poverty Guidelines, 90 FR 5917, https://www.federalregister.gov/documents/2025/01/17/2025-01377/annual-update-of-the-hhs-poverty-guidelines';
const HHS_FPL_2026 =
  'HHS 2026 Poverty Guidelines, 91 FR 1797, https://www.govinfo.gov/content/pkg/FR-2026-01-15/html/2026-00755.htm';
const IRS_REV_PROC_2025_25 =
  'IRS Rev. Proc. 2025-25, 2026 ACA applicable percentage table, https://www.irs.gov/pub/irs-drop/rp-25-25.pdf';
const IRS_FORM_8962_2025 =
  'IRS Instructions for Form 8962 (2025), premium tax credit and APTC reconciliation worksheets, https://www.irs.gov/instructions/i8962';
const IRC_36B =
  '26 U.S.C. § 36B, premium assistance credit amount and reconciliation, https://uscode.house.gov/view.xhtml?req=(title:26%20section:36B%20edition:prelim)';

describe('ACA premium tax credit fixtures', () => {
  it('uses prior-year FPL for 2026 coverage and 2026 FPL for 2027 coverage', () => {
    const citations = [HHS_FPL_2025, HHS_FPL_2026, IRC_36B];
    expect(citations.join('; ')).toMatch(/2025 Poverty Guidelines/);

    const coverage2026 = getFPLForCoverageYear(2026);
    const coverage2027 = getFPLForCoverageYear(2027);

    expect(coverage2026.year).toBe(2025);
    expect(coverage2026.contiguous.householdSize[2]).toBe(21_150);
    expect(coverage2026.contiguous.householdSize[2]).not.toBe(21_640);

    expect(coverage2027.year).toBe(2026);
    expect(coverage2027.contiguous.householdSize[2]).toBe(21_640);
  });

  it('indexes post-2027 FPL tables forward without mutating published constants', () => {
    const citations = [HHS_FPL_2026, IRC_36B];
    expect(citations.join('; ')).toMatch(/2026 Poverty Guidelines/);

    const indexed = getFPLForCoverageYear({ coverageYear: 2028, fplIndexingRate: 0.03 });

    expect(indexed.year).toBe(2027);
    expect(indexed.indexedFromYear).toBe(2026);
    expect(indexed.indexingRate).toBe(0.03);
    expect(indexed.contiguous.householdSize[2]).toBe(22_289);
    expect(indexed.contiguous.additionalPerPerson).toBe(5_850);
    expect(CONSTANTS_2026.fpl.contiguous.householdSize[2]).toBe(21_640);
    expect(CONSTANTS_2026.fpl.contiguous.additionalPerPerson).toBe(5_680);
  });

  it('interpolates applicable percentage bands without intermediate dollar rounding', () => {
    const citations = [IRS_REV_PROC_2025_25];
    expect(citations.join('; ')).toContain('Rev. Proc. 2025-25');

    expect(computeApplicablePercentage(1.4)).toBeCloseTo(0.0357235294117647, 12);
    expect(computeApplicablePercentage(2)).toBe(0.066);
    expect(computeApplicablePercentage(3.5)).toBe(0.0996);
  });

  it('computes required contribution at the public cents boundary', () => {
    const citations = [IRS_REV_PROC_2025_25, IRS_FORM_8962_2025];
    expect(citations.join('; ')).toMatch(/Form 8962/);

    expect(computeRequiredContribution({ householdIncome: 42_300, applicablePercentage: 0.066 })).toBe(2_791.8);
  });

  it('computes annual premium tax credit from 2026 lagged FPL, SLCSP, and enrollment cap', () => {
    const citations = [HHS_FPL_2025, IRS_REV_PROC_2025_25, IRS_FORM_8962_2025, IRC_36B];
    const worksheetWalk =
      '2026 coverage uses 2025 contiguous FPL of 21,150 for household size 2. Household income 42,300 is 200% FPL, the applicable percentage is 6.60%, required contribution is 2,791.80, and SLCSP 14,400 less required contribution gives an 11,608.20 credit below the 13,200 enrollment premium.';

    expect(citations.join('; ')).toMatch(/36B/);
    expect(worksheetWalk).toMatch(/2025 contiguous FPL/);

    expect(
      computePremiumTaxCredit({
        coverageYear: 2026,
        householdIncome: 42_300,
        householdSize: 2,
        annualBenchmarkPremium: 14_400,
        annualEnrollmentPremium: 13_200,
      }),
    ).toEqual({
      premiumTaxCredit: 11_608.2,
      fplPercent: 2,
      applicablePercentage: 0.066,
      requiredContribution: 2_791.8,
      isEligible: true,
    });
  });

  it('returns zero credit below 100% FPL', () => {
    const citations = [HHS_FPL_2025, IRS_FORM_8962_2025, IRC_36B];
    expect(citations.join('; ')).toMatch(/Form 8962/);

    const result = computePremiumTaxCredit({
      coverageYear: 2026,
      householdIncome: 15_000,
      householdSize: 1,
      annualBenchmarkPremium: 8_400,
    });

    expect(result.premiumTaxCredit).toBe(0);
    expect(result.fplPercent).toBeCloseTo(0.9584664536741214, 12);
    expect(result.applicablePercentage).toBe(0);
    expect(result.requiredContribution).toBe(0);
    expect(result.isEligible).toBe(false);
  });

  it('fully repays excess APTC for coverage years 2026 and later', () => {
    const citations = [IRS_FORM_8962_2025, IRC_36B];
    expect(citations.join('; ')).toMatch(/reconciliation|36B/);

    expect(
      computeAptcReconciliation({
        coverageYear: 2026,
        allowedPremiumTaxCredit: 10_000,
        advancePremiumTaxCredit: 12_345.67,
      }),
    ).toEqual({
      allowedPremiumTaxCredit: 10_000,
      advancePremiumTaxCredit: 12_345.67,
      netPremiumTaxCredit: 0,
      excessAdvancePremiumTaxCredit: 2_345.67,
      repaymentAmount: 2_345.67,
      repaymentCap: null,
      isRepaymentCapped: false,
    });
  });

  it('does not invent pre-2026 APTC repayment caps', () => {
    expect(() =>
      computeAptcReconciliation({
        coverageYear: 2025,
        allowedPremiumTaxCredit: 10_000,
        advancePremiumTaxCredit: 12_000,
      }),
    ).toThrow(/Pre-2026 APTC repayment caps/);
  });
});
