import { describe, expect, it } from 'vitest';

import { computeTaxableSocialSecurity } from '@/core/tax/socialSecurity';
import type { FilingStatus } from '@/core/types';

const IRS_PUB_915_2025_URL = 'https://www.irs.gov/publications/p915';

type Pub915Fixture = {
  label: string;
  filingStatus: FilingStatus;
  grossSocialSecurityBenefits: number;
  otherIncomeBeforeSocialSecurity: number;
  taxExemptInterest: number;
  expectedProvisionalIncome: number;
  expectedTaxableAmount: number;
  expectedThresholds: {
    tier1: number;
    tier2: number;
  };
  citation: string;
};

/*
 * Expected values below are hand-entered from IRS Publication 915 (2025):
 * Worksheet A computes provisional income as 50% of benefits plus taxable
 * other income plus tax-exempt interest, and Worksheet 1 computes the taxable
 * benefit amount using the 50% zone, 85% zone, and 85% benefit cap.
 */
const pub915Fixtures: readonly Pub915Fixture[] = [
  {
    label: 'Worksheet A filled-in example is below the single base amount',
    filingStatus: 'single',
    grossSocialSecurityBenefits: 1_500,
    otherIncomeBeforeSocialSecurity: 17_700,
    taxExemptInterest: 0,
    expectedProvisionalIncome: 18_450,
    expectedTaxableAmount: 0,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation:
      `IRS Publication 915 (2025), Worksheet A filled-in example and Base amount section, ${IRS_PUB_915_2025_URL}`,
  },
  {
    label: 'Example 1 taxable benefits are capped by half the benefits in the 50% zone',
    filingStatus: 'single',
    grossSocialSecurityBenefits: 5_980,
    otherIncomeBeforeSocialSecurity: 28_990,
    taxExemptInterest: 0,
    expectedProvisionalIncome: 31_980,
    expectedTaxableAmount: 2_990,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation:
      `IRS Publication 915 (2025), How Much Is Taxable, Examples, Example 1 filled-in Worksheet 1, ${IRS_PUB_915_2025_URL}`,
  },
  {
    label: 'tax-exempt interest moves a single filer into the 50% taxable zone',
    filingStatus: 'single',
    grossSocialSecurityBenefits: 10_000,
    otherIncomeBeforeSocialSecurity: 19_000,
    taxExemptInterest: 5_000,
    expectedProvisionalIncome: 29_000,
    expectedTaxableAmount: 2_000,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation:
      `IRS Publication 915 (2025), Worksheet A lines C-D and Worksheet 1 lines 3-6, 9-18, ${IRS_PUB_915_2025_URL}`,
  },
  {
    label: 'MFJ filer uses the joint base amount in the 50% taxable zone',
    filingStatus: 'mfj',
    grossSocialSecurityBenefits: 24_000,
    otherIncomeBeforeSocialSecurity: 22_000,
    taxExemptInterest: 0,
    expectedProvisionalIncome: 34_000,
    expectedTaxableAmount: 1_000,
    expectedThresholds: { tier1: 32_000, tier2: 44_000 },
    citation:
      `IRS Publication 915 (2025), Base amount section and Worksheet 1 married filing jointly line 9 amount, ${IRS_PUB_915_2025_URL}`,
  },
  {
    label: 'single filer in the 85% zone adds 85% of excess over $34,000',
    filingStatus: 'single',
    grossSocialSecurityBenefits: 20_000,
    otherIncomeBeforeSocialSecurity: 30_000,
    taxExemptInterest: 0,
    expectedProvisionalIncome: 40_000,
    expectedTaxableAmount: 9_600,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation:
      `IRS Publication 915 (2025), Maximum taxable part section and Worksheet 1 lines 11-18 for non-joint filers, ${IRS_PUB_915_2025_URL}`,
  },
  {
    label: 'MFJ filer in the 85% zone uses the $12,000 joint tier spread',
    filingStatus: 'mfj',
    grossSocialSecurityBenefits: 30_000,
    otherIncomeBeforeSocialSecurity: 40_000,
    taxExemptInterest: 0,
    expectedProvisionalIncome: 55_000,
    expectedTaxableAmount: 15_350,
    expectedThresholds: { tier1: 32_000, tier2: 44_000 },
    citation:
      `IRS Publication 915 (2025), Maximum taxable part section and Worksheet 1 married filing jointly line 11 amount, ${IRS_PUB_915_2025_URL}`,
  },
];

describe('IRS Publication 915 Social Security fixtures', () => {
  it.each(pub915Fixtures)(
    '$label',
    ({
      citation,
      expectedProvisionalIncome,
      expectedTaxableAmount,
      expectedThresholds,
      filingStatus,
      grossSocialSecurityBenefits,
      otherIncomeBeforeSocialSecurity,
      taxExemptInterest,
    }) => {
      expect(citation).toContain('Publication 915');

      const result = computeTaxableSocialSecurity({
        filingStatus,
        grossSocialSecurityBenefits,
        otherIncomeBeforeSocialSecurity,
        taxExemptInterest,
      });

      expect(result.provisionalIncome).toBeCloseTo(expectedProvisionalIncome, 2);
      expect(result.taxableAmount).toBeCloseTo(expectedTaxableAmount, 2);
      expect(result.thresholds).toEqual(expectedThresholds);
    },
  );
});
