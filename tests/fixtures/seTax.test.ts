import { describe, expect, it } from 'vitest';

import { computeSeTax } from '@/core/tax/seTax';
import type { FilingStatus } from '@/core/types';

const IRS_SCHEDULE_SE_2025 =
  'IRS Schedule SE (Form 1040) 2025, Part I lines 4a, 4c, 6, 10, 11, 12 and Part II line 13, https://www.irs.gov/pub/irs-pdf/f1040sse.pdf';
const IRS_SCHEDULE_SE_INSTRUCTIONS_2025 =
  'IRS Instructions for Schedule SE (Form 1040) 2025, Social Security wage base and Additional Medicare Tax line instructions, https://www.irs.gov/pub/irs-pdf/i1040sse.pdf';
const SSA_2026_COLA =
  'Social Security Administration 2026 COLA Fact Sheet, 2026 OASDI wage base, https://www.ssa.gov/cola/factsheets/2026.html';
const IRS_ADDITIONAL_MEDICARE =
  'IRS self-employment tax guidance, Additional Medicare Tax thresholds, https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes';

type SeTaxFixture = {
  label: string;
  input: {
    netSeIncome: number;
    w2WagesSubjectToSs: number;
    totalMedicareWages: number;
    filingStatus: FilingStatus;
  };
  expected: ReturnType<typeof computeSeTax>;
  citation: string;
};

/*
 * Expected outputs are hand-entered Schedule SE walks:
 * line 4a net SE income, line 4c = line 4a * 92.35%, line 6 OASDI
 * wage-base limit, line 10 OASDI tax at 12.4%, line 11 Medicare tax at
 * 2.9%, line 12 deductible half excluding Additional Medicare Tax, and
 * Part II line 13 Additional Medicare Tax at 0.9% where applicable.
 */
const seTaxFixtures: readonly SeTaxFixture[] = [
  {
    label: 'Case A: below Social Security wage base with no W-2 wages and no Additional Medicare Tax',
    input: {
      netSeIncome: 100_000,
      w2WagesSubjectToSs: 0,
      totalMedicareWages: 0,
      filingStatus: 'single',
    },
    // Schedule SE walk: 100,000 * 92.35% = 92,350; OASDI 92,350 * 12.4%;
    // Medicare 92,350 * 2.9%; no Additional Medicare below $200,000.
    expected: {
      adjustedSeIncome: 92_350,
      socialSecurityTaxableIncome: 92_350,
      socialSecurityTax: 11_451.4,
      medicareTax: 2_678.15,
      additionalMedicareTax: 0,
      totalSeTax: 14_129.55,
      deductibleHalf: 7_064.78,
    },
    citation: `${IRS_SCHEDULE_SE_2025}; ${IRS_ADDITIONAL_MEDICARE}`,
  },
  {
    label: 'Case B: W-2 Social Security wages cap SE OASDI tax to remaining wage base',
    input: {
      netSeIncome: 50_000,
      w2WagesSubjectToSs: 180_000,
      totalMedicareWages: 180_000,
      filingStatus: 'mfj',
    },
    // Schedule SE walk: adjusted SE income is 50,000 * 92.35% = 46,175.
    // 2026 OASDI wage base 184,500 less 180,000 W-2 SS wages leaves 4,500.
    // OASDI tax is min(46,175, 4,500) * 12.4%; MFJ Medicare total stays
    // below the $250,000 Additional Medicare threshold.
    expected: {
      adjustedSeIncome: 46_175,
      socialSecurityTaxableIncome: 4_500,
      socialSecurityTax: 558,
      medicareTax: 1_339.08,
      additionalMedicareTax: 0,
      totalSeTax: 1_897.08,
      deductibleHalf: 948.54,
    },
    citation: `${IRS_SCHEDULE_SE_2025}; ${IRS_SCHEDULE_SE_INSTRUCTIONS_2025}; ${SSA_2026_COLA}; ${IRS_ADDITIONAL_MEDICARE}`,
  },
  {
    label: 'Case C: single filer owes Additional Medicare Tax on SE income above the $200,000 threshold',
    input: {
      netSeIncome: 20_000,
      w2WagesSubjectToSs: 184_500,
      totalMedicareWages: 200_000,
      filingStatus: 'single',
    },
    // Schedule SE walk: adjusted SE income is 18,470. W-2 SS wages use the
    // 184,500 OASDI wage base, so SE OASDI tax is zero. Medicare tax is
    // 18,470 * 2.9%; Additional Medicare is 18,470 * 0.9% because W-2
    // Medicare wages already reach the single $200,000 threshold.
    expected: {
      adjustedSeIncome: 18_470,
      socialSecurityTaxableIncome: 0,
      socialSecurityTax: 0,
      medicareTax: 535.63,
      additionalMedicareTax: 166.23,
      totalSeTax: 701.86,
      deductibleHalf: 267.82,
    },
    citation: `${IRS_SCHEDULE_SE_2025}; ${IRS_SCHEDULE_SE_INSTRUCTIONS_2025}; ${SSA_2026_COLA}; ${IRS_ADDITIONAL_MEDICARE}`,
  },
  {
    label: 'Case D1: zero net SE income returns zero components',
    input: {
      netSeIncome: 0,
      w2WagesSubjectToSs: 184_500,
      totalMedicareWages: 250_000,
      filingStatus: 'single',
    },
    // Schedule SE has no line 4c earnings to carry to OASDI, Medicare, or
    // Additional Medicare computations.
    expected: {
      adjustedSeIncome: 0,
      socialSecurityTaxableIncome: 0,
      socialSecurityTax: 0,
      medicareTax: 0,
      additionalMedicareTax: 0,
      totalSeTax: 0,
      deductibleHalf: 0,
    },
    citation: IRS_SCHEDULE_SE_2025,
  },
  {
    label: 'Case D2: negative net SE income returns zero components',
    input: {
      netSeIncome: -10_000,
      w2WagesSubjectToSs: 0,
      totalMedicareWages: 0,
      filingStatus: 'mfj',
    },
    // Schedule SE has no positive line 4c earnings to carry to OASDI,
    // Medicare, or Additional Medicare computations.
    expected: {
      adjustedSeIncome: 0,
      socialSecurityTaxableIncome: 0,
      socialSecurityTax: 0,
      medicareTax: 0,
      additionalMedicareTax: 0,
      totalSeTax: 0,
      deductibleHalf: 0,
    },
    citation: IRS_SCHEDULE_SE_2025,
  },
];

describe('Schedule SE self-employment tax fixtures', () => {
  it.each(seTaxFixtures)('$label', ({ citation, expected, input }) => {
    expect(citation).toContain('Schedule SE');

    expect(computeSeTax(input)).toEqual(expected);
  });
});
