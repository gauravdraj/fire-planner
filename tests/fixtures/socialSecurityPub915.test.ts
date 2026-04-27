import { describe, expect, it } from 'vitest';

import { computeTaxableSocialSecurity } from '@/core/tax/socialSecurity';
import type { FilingStatus } from '@/core/types';

const IRS_PUB_915_2025 =
  'IRS Publication 915 (2025), Social Security and Equivalent Railroad Retirement Benefits, Worksheet A and Worksheet 1, https://www.irs.gov/publications/p915';

type SocialSecurityFixture = {
  label: string;
  filingStatus: FilingStatus;
  grossSocialSecurityBenefits: number;
  otherIncomeBeforeSocialSecurity: number;
  taxExemptInterest: number;
  expectedTaxableAmount: number;
  expectedProvisionalIncome: number;
  expectedThresholds: {
    tier1: number;
    tier2: number;
  };
  citation: string;
  isMfsLivingTogether?: boolean;
};

/*
 * Expected values are hand-entered from Pub. 915 Worksheet A / Worksheet 1:
 * provisional income is other income plus tax-exempt interest plus half of
 * benefits; taxable benefits use the 50% tier, then the 85% tier and 85% cap.
 * They are not derived from project constants.
 */
const socialSecurityFixtures: readonly SocialSecurityFixture[] = [
  {
    label: 'Pub 915 Worksheet A example has no taxable benefits below the single base amount',
    filingStatus: 'single',
    grossSocialSecurityBenefits: 1_500,
    otherIncomeBeforeSocialSecurity: 17_700,
    taxExemptInterest: 0,
    expectedTaxableAmount: 0,
    expectedProvisionalIncome: 18_450,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation: IRS_PUB_915_2025,
  },
  {
    label: 'Pub 915 Example 1 taxable benefits are capped by half of benefits in the 50% zone',
    filingStatus: 'single',
    grossSocialSecurityBenefits: 5_980,
    otherIncomeBeforeSocialSecurity: 28_990,
    taxExemptInterest: 0,
    expectedTaxableAmount: 2_990,
    expectedProvisionalIncome: 31_980,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation: IRS_PUB_915_2025,
  },
  {
    label: 'single filer in the 85% zone adds 85% excess over tier 2 to the tier-zone amount',
    filingStatus: 'single',
    grossSocialSecurityBenefits: 20_000,
    otherIncomeBeforeSocialSecurity: 30_000,
    taxExemptInterest: 0,
    expectedTaxableAmount: 9_600,
    expectedProvisionalIncome: 40_000,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation: IRS_PUB_915_2025,
  },
  {
    label: 'single filer taxable benefits never exceed 85% of benefits',
    filingStatus: 'single',
    grossSocialSecurityBenefits: 12_000,
    otherIncomeBeforeSocialSecurity: 100_000,
    taxExemptInterest: 0,
    expectedTaxableAmount: 10_200,
    expectedProvisionalIncome: 106_000,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation: IRS_PUB_915_2025,
  },
  {
    label: 'married filing jointly uses MFJ thresholds and includes tax-exempt interest',
    filingStatus: 'mfj',
    grossSocialSecurityBenefits: 30_000,
    otherIncomeBeforeSocialSecurity: 25_000,
    taxExemptInterest: 2_000,
    expectedTaxableAmount: 5_000,
    expectedProvisionalIncome: 42_000,
    expectedThresholds: { tier1: 32_000, tier2: 44_000 },
    citation: IRS_PUB_915_2025,
  },
  {
    label: 'married filing jointly in the 85% zone uses the $12,000 tier spread',
    filingStatus: 'mfj',
    grossSocialSecurityBenefits: 30_000,
    otherIncomeBeforeSocialSecurity: 40_000,
    taxExemptInterest: 0,
    expectedTaxableAmount: 15_350,
    expectedProvisionalIncome: 55_000,
    expectedThresholds: { tier1: 32_000, tier2: 44_000 },
    citation: IRS_PUB_915_2025,
  },
  {
    label: 'head of household uses the single threshold set',
    filingStatus: 'hoh',
    grossSocialSecurityBenefits: 10_000,
    otherIncomeBeforeSocialSecurity: 26_000,
    taxExemptInterest: 0,
    expectedTaxableAmount: 3_000,
    expectedProvisionalIncome: 31_000,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation: IRS_PUB_915_2025,
  },
  {
    label: 'married filing separately living apart uses the single threshold set',
    filingStatus: 'mfs',
    grossSocialSecurityBenefits: 10_000,
    otherIncomeBeforeSocialSecurity: 26_000,
    taxExemptInterest: 0,
    expectedTaxableAmount: 3_000,
    expectedProvisionalIncome: 31_000,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation: IRS_PUB_915_2025,
    isMfsLivingTogether: false,
  },
  {
    label: 'married filing separately living together uses zero thresholds',
    filingStatus: 'mfs',
    grossSocialSecurityBenefits: 10_000,
    otherIncomeBeforeSocialSecurity: 0,
    taxExemptInterest: 0,
    expectedTaxableAmount: 4_250,
    expectedProvisionalIncome: 5_000,
    expectedThresholds: { tier1: 0, tier2: 0 },
    citation: IRS_PUB_915_2025,
    isMfsLivingTogether: true,
  },
  {
    label: 'married filing separately living together remains capped at 85% of benefits',
    filingStatus: 'mfs',
    grossSocialSecurityBenefits: 10_000,
    otherIncomeBeforeSocialSecurity: 20_000,
    taxExemptInterest: 0,
    expectedTaxableAmount: 8_500,
    expectedProvisionalIncome: 25_000,
    expectedThresholds: { tier1: 0, tier2: 0 },
    citation: IRS_PUB_915_2025,
    isMfsLivingTogether: true,
  },
  {
    label: 'provisional income exactly at tier 1 has no taxable benefits',
    filingStatus: 'single',
    grossSocialSecurityBenefits: 10_000,
    otherIncomeBeforeSocialSecurity: 20_000,
    taxExemptInterest: 0,
    expectedTaxableAmount: 0,
    expectedProvisionalIncome: 25_000,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation: IRS_PUB_915_2025,
  },
  {
    label: 'provisional income exactly at tier 2 uses the full single tier-zone amount',
    filingStatus: 'single',
    grossSocialSecurityBenefits: 20_000,
    otherIncomeBeforeSocialSecurity: 24_000,
    taxExemptInterest: 0,
    expectedTaxableAmount: 4_500,
    expectedProvisionalIncome: 34_000,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation: IRS_PUB_915_2025,
  },
  {
    label: 'taxable benefits round to cents at the return boundary',
    filingStatus: 'single',
    grossSocialSecurityBenefits: 1_000,
    otherIncomeBeforeSocialSecurity: 24_550.01,
    taxExemptInterest: 0,
    expectedTaxableAmount: 25.01,
    expectedProvisionalIncome: 25_050.01,
    expectedThresholds: { tier1: 25_000, tier2: 34_000 },
    citation: IRS_PUB_915_2025,
  },
];

describe('Pub 915 taxable Social Security fixtures', () => {
  it.each(socialSecurityFixtures)(
    '$label',
    ({
      citation,
      expectedProvisionalIncome,
      expectedTaxableAmount,
      expectedThresholds,
      filingStatus,
      grossSocialSecurityBenefits,
      isMfsLivingTogether,
      otherIncomeBeforeSocialSecurity,
      taxExemptInterest,
    }) => {
      expect(citation).toContain('Publication 915');

      const result = computeTaxableSocialSecurity({
        filingStatus,
        grossSocialSecurityBenefits,
        ...(isMfsLivingTogether === undefined ? {} : { isMfsLivingTogether }),
        otherIncomeBeforeSocialSecurity,
        taxExemptInterest,
      });

      expect(result).toEqual({
        taxableAmount: expectedTaxableAmount,
        provisionalIncome: expectedProvisionalIncome,
        thresholds: expectedThresholds,
      });
    },
  );
});
