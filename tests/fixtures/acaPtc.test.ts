import { describe, expect, it } from 'vitest';

import {
  computeAptcReconciliation,
  computePremiumTaxCredit,
  getFPLForCoverageYear,
  type PremiumTaxCreditInput,
} from '@/core/tax/aca';

const IRS_FORM_8962_2025 =
  'IRS Instructions for Form 8962 (2025), Part I lines 5, 7, 8a/8b and Part II line 11, retrieved 2026-04-26, https://www.irs.gov/instructions/i8962';
const IRS_PUB_974_2025 =
  'IRS Publication 974 (2025), Premium Tax Credit terms and worked worksheets, retrieved 2026-04-26, https://www.irs.gov/publications/p974';
const IRS_REV_PROC_2025_25 =
  'IRS Rev. Proc. 2025-25 section 3.01, 2026 applicable percentage table, retrieved 2026-04-26, https://www.irs.gov/pub/irs-drop/rp-25-25.pdf';
const HHS_FPL_2025 =
  'HHS 2025 Poverty Guidelines, 90 FR 5917, retrieved 2026-04-26, https://www.federalregister.gov/documents/2025/01/17/2025-01377/annual-update-of-the-hhs-poverty-guidelines';
const HHS_FPL_2026 =
  'HHS 2026 Poverty Guidelines, 91 FR 1797, retrieved 2026-04-26, https://www.govinfo.gov/content/pkg/FR-2026-01-15/html/2026-00755.htm';
const IRS_FS_2025_10 =
  'IRS FS-2025-10 Q7, prior-year FPL example for Premium Tax Credit, retrieved 2026-04-26, https://www.irs.gov/pub/taxpros/fs-2025-10.pdf';
const IRC_36B =
  '26 U.S.C. § 36B(b)(2), (b)(3), (c)(1), (d)(3), and (f)(2), retrieved 2026-04-26, https://uscode.house.gov/view.xhtml?req=(title:26%20section:36B%20edition:prelim)';

type PtcFixture = Readonly<{
  name: string;
  citation: string;
  worksheetWalk: string;
  input: PremiumTaxCreditInput;
  expected: Readonly<{
    fplPercent: number;
    applicablePercentage: number;
    requiredContribution: number;
    premiumTaxCredit: number;
  }>;
}>;

const ptcFixtures = [
  {
    name: '150% FPL single household with benchmark credit below enrollment premium',
    citation: `${IRS_FORM_8962_2025}; ${IRS_PUB_974_2025}; ${IRS_REV_PROC_2025_25}; ${HHS_FPL_2025}; ${IRC_36B}`,
    worksheetWalk:
      '2026 coverage uses the 2025 contiguous FPL of $15,650 for household size 1. Household income $23,475 is exactly 150% FPL. Rev. Proc. 2025-25 gives a 4.19% applicable percentage at 150% FPL. Form 8962 line 8a contribution is $23,475 * 0.0419 = $983.6025, rounded to $983.60. Section 36B and Pub. 974 monthly-credit rules give annual PTC as the lesser of $8,000 enrollment premium or $7,200 SLCSP - $983.60 = $6,216.40.',
    input: {
      coverageYear: 2026,
      householdIncome: 23_475,
      householdSize: 1,
      annualBenchmarkPremium: 7_200,
      annualEnrollmentPremium: 8_000,
    },
    expected: {
      fplPercent: 1.5,
      applicablePercentage: 0.0419,
      requiredContribution: 983.6,
      premiumTaxCredit: 6_216.4,
    },
  },
  {
    name: '200% FPL two-person household with full SLCSP-based annual credit',
    citation: `${IRS_FORM_8962_2025}; ${IRS_PUB_974_2025}; ${IRS_REV_PROC_2025_25}; ${HHS_FPL_2025}; ${IRC_36B}`,
    worksheetWalk:
      '2026 coverage uses the 2025 contiguous FPL of $21,150 for household size 2. Household income $42,300 is exactly 200% FPL. Rev. Proc. 2025-25 gives a 6.60% applicable percentage at 200% FPL. Form 8962 line 8a contribution is $42,300 * 0.066 = $2,791.80. Annual PTC is the lesser of $13,200 enrollment premium or $14,400 SLCSP - $2,791.80 = $11,608.20.',
    input: {
      coverageYear: 2026,
      householdIncome: 42_300,
      householdSize: 2,
      annualBenchmarkPremium: 14_400,
      annualEnrollmentPremium: 13_200,
    },
    expected: {
      fplPercent: 2,
      applicablePercentage: 0.066,
      requiredContribution: 2_791.8,
      premiumTaxCredit: 11_608.2,
    },
  },
  {
    name: '300% FPL three-person household at the top applicable percentage',
    citation: `${IRS_FORM_8962_2025}; ${IRS_PUB_974_2025}; ${IRS_REV_PROC_2025_25}; ${HHS_FPL_2025}; ${IRC_36B}`,
    worksheetWalk:
      '2026 coverage uses the 2025 contiguous FPL of $26,650 for household size 3. Household income $79,950 is exactly 300% FPL. Rev. Proc. 2025-25 gives a 9.96% applicable percentage at 300% FPL. Form 8962 line 8a contribution is $79,950 * 0.0996 = $7,963.02. Annual PTC is the lesser of $18,000 enrollment premium or $17,400 SLCSP - $7,963.02 = $9,436.98.',
    input: {
      coverageYear: 2026,
      householdIncome: 79_950,
      householdSize: 3,
      annualBenchmarkPremium: 17_400,
      annualEnrollmentPremium: 18_000,
    },
    expected: {
      fplPercent: 3,
      applicablePercentage: 0.0996,
      requiredContribution: 7_963.02,
      premiumTaxCredit: 9_436.98,
    },
  },
] satisfies readonly PtcFixture[];

describe('ACA PTC source-backed fixture suite', () => {
  for (const fixture of ptcFixtures) {
    it(`computes exact PTC cents for ${fixture.name}`, () => {
      expect(fixture.citation).toContain('Form 8962');
      expect(fixture.citation).toContain('Publication 974');
      expect(fixture.worksheetWalk).toMatch(/annual PTC/i);

      const result = computePremiumTaxCredit(fixture.input);

      expect(result.isEligible).toBe(true);
      expect(result.fplPercent).toBe(fixture.expected.fplPercent);
      expect(result.applicablePercentage).toBe(fixture.expected.applicablePercentage);
      expect(result.requiredContribution).toBe(fixture.expected.requiredContribution);
      expect(result.premiumTaxCredit).toBe(fixture.expected.premiumTaxCredit);
    });
  }

  it('uses 2025 FPL for 2026 coverage-year PTC calculations', () => {
    const fixture = {
      citation: `${IRC_36B}; ${IRS_FS_2025_10}; ${HHS_FPL_2025}; ${HHS_FPL_2026}`,
      worksheetWalk:
        'IRC section 36B(d)(3)(B) uses the poverty line most recently published as of the first day of the regular enrollment period for the coverage year. FS-2025-10 Q7 gives the same prior-year FPL rule by example. For 2026 coverage, the published table available at open enrollment is the 2025 HHS table, where a contiguous household of 2 is $21,150; the later 2026 HHS value is $21,640 and must not be used for 2026 PTC.',
    };

    expect(fixture.citation).toContain('FS-2025-10');
    expect(fixture.worksheetWalk).toContain('$21,150');

    const fpl = getFPLForCoverageYear(2026);

    expect(fpl.year).toBe(2025);
    expect(fpl.contiguous.householdSize[2]).toBe(21_150);
    expect(fpl.contiguous.householdSize[2]).not.toBe(21_640);
  });

  it('fully repays excess APTC for 2026 and later with no statutory cap', () => {
    const fixture = {
      citation: `${IRS_FORM_8962_2025}; ${IRC_36B}`,
      worksheetWalk:
        'Allowed PTC is $10,000.00 and advance PTC is $12,345.67, so excess APTC is $12,345.67 - $10,000.00 = $2,345.67. Current IRC section 36B(f)(2) increases tax by the amount of that excess, with no post-2025 repayment-cap table applied.',
    };

    expect(fixture.citation).toContain('36B');
    expect(fixture.worksheetWalk).toContain('$2,345.67');

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
});
