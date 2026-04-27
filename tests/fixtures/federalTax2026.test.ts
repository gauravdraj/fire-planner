import { describe, expect, it } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import { computeFederalTax, computeTaxableIncome } from '@/core/tax/federal';
import type { FilingStatus } from '@/core/types';

const IRS_REV_PROC_2025_32 =
  'IRS Rev. Proc. 2025-32, 2026 inflation-adjusted tax items, federal income tax rate schedules and standard deductions, https://www.irs.gov/pub/irs-drop/rp-25-32.pdf';
const IRS_OBBBA_SENIOR_DEDUCTION =
  'IRS FS-2025-03, OBBBA tax deductions for workers and seniors, https://www.irs.gov/newsroom/one-big-beautiful-bill-act-tax-deductions-for-working-americans-and-seniors';
const IRC_151_SENIOR_DEDUCTION =
  '26 U.S.C. § 151(d)(5)(C), senior deduction phaseout, https://uscode.house.gov/view.xhtml?req=(title:26%20section:151%20edition:prelim)';

type OrdinaryTaxCase = {
  filingStatus: FilingStatus;
  taxableIncome: number;
  expectedTax: number;
  label: string;
  citation: string;
};

type TaxableIncomeCase = {
  filingStatus: FilingStatus;
  agi: number;
  expectedTaxableIncome: number;
  label: string;
  options?: Parameters<typeof computeTaxableIncome>[2];
  citation: string;
};

/*
 * Gate 1 validates bracket-formula ordinary tax on actual taxable income.
 * These are not IRS Form 1040 tax-table fixtures and intentionally do not
 * model unavailable 2026 $50-range tax-table midpoint behavior.
 *
 * Expected taxes are hand-entered from independent worksheet walks using
 * Rev. Proc. 2025-32 bracket thresholds and statutory rates, not imported or
 * derived from CONSTANTS_2026.
 */
const ordinaryTaxFixtures: readonly OrdinaryTaxCase[] = [
  { filingStatus: 'single', taxableIncome: 0, expectedTax: 0, label: 'zero taxable income', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 12_400, expectedTax: 1_240, label: 'at 12% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 12_401, expectedTax: 1_240.12, label: '$1 above 12% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 50_400, expectedTax: 5_800, label: 'at 22% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 50_401, expectedTax: 5_800.22, label: '$1 above 22% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 105_700, expectedTax: 17_966, label: 'at 24% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 105_701, expectedTax: 17_966.24, label: '$1 above 24% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 201_775, expectedTax: 41_024, label: 'at 32% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 201_776, expectedTax: 41_024.32, label: '$1 above 32% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 256_225, expectedTax: 58_448, label: 'at 35% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 256_226, expectedTax: 58_448.35, label: '$1 above 35% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 640_600, expectedTax: 192_979.25, label: 'at 37% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'single', taxableIncome: 640_601, expectedTax: 192_979.62, label: '$1 above 37% boundary', citation: IRS_REV_PROC_2025_32 },

  { filingStatus: 'mfj', taxableIncome: 0, expectedTax: 0, label: 'zero taxable income', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 24_800, expectedTax: 2_480, label: 'at 12% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 24_801, expectedTax: 2_480.12, label: '$1 above 12% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 100_800, expectedTax: 11_600, label: 'at 22% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 100_801, expectedTax: 11_600.22, label: '$1 above 22% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 211_400, expectedTax: 35_932, label: 'at 24% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 211_401, expectedTax: 35_932.24, label: '$1 above 24% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 403_550, expectedTax: 82_048, label: 'at 32% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 403_551, expectedTax: 82_048.32, label: '$1 above 32% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 512_450, expectedTax: 116_896, label: 'at 35% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 512_451, expectedTax: 116_896.35, label: '$1 above 35% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 768_700, expectedTax: 206_583.5, label: 'at 37% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfj', taxableIncome: 768_701, expectedTax: 206_583.87, label: '$1 above 37% boundary', citation: IRS_REV_PROC_2025_32 },

  { filingStatus: 'hoh', taxableIncome: 0, expectedTax: 0, label: 'zero taxable income', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 17_700, expectedTax: 1_770, label: 'at 12% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 17_701, expectedTax: 1_770.12, label: '$1 above 12% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 67_450, expectedTax: 7_740, label: 'at 22% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 67_451, expectedTax: 7_740.22, label: '$1 above 22% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 105_700, expectedTax: 16_155, label: 'at 24% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 105_701, expectedTax: 16_155.24, label: '$1 above 24% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 201_750, expectedTax: 39_207, label: 'at 32% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 201_751, expectedTax: 39_207.32, label: '$1 above 32% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 256_200, expectedTax: 56_631, label: 'at 35% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 256_201, expectedTax: 56_631.35, label: '$1 above 35% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 640_600, expectedTax: 191_171, label: 'at 37% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'hoh', taxableIncome: 640_601, expectedTax: 191_171.37, label: '$1 above 37% boundary', citation: IRS_REV_PROC_2025_32 },

  { filingStatus: 'mfs', taxableIncome: 0, expectedTax: 0, label: 'zero taxable income', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 12_400, expectedTax: 1_240, label: 'at 12% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 12_401, expectedTax: 1_240.12, label: '$1 above 12% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 50_400, expectedTax: 5_800, label: 'at 22% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 50_401, expectedTax: 5_800.22, label: '$1 above 22% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 105_700, expectedTax: 17_966, label: 'at 24% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 105_701, expectedTax: 17_966.24, label: '$1 above 24% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 201_775, expectedTax: 41_024, label: 'at 32% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 201_776, expectedTax: 41_024.32, label: '$1 above 32% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 256_225, expectedTax: 58_448, label: 'at 35% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 256_226, expectedTax: 58_448.35, label: '$1 above 35% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 384_350, expectedTax: 103_291.75, label: 'at 37% boundary', citation: IRS_REV_PROC_2025_32 },
  { filingStatus: 'mfs', taxableIncome: 384_351, expectedTax: 103_292.12, label: '$1 above 37% boundary', citation: IRS_REV_PROC_2025_32 },
];

const taxableIncomeFixtures: readonly TaxableIncomeCase[] = [
  {
    filingStatus: 'single',
    agi: 50_000,
    expectedTaxableIncome: 33_900,
    label: 'single standard deduction',
    citation: IRS_REV_PROC_2025_32,
  },
  {
    filingStatus: 'mfj',
    agi: 100_000,
    expectedTaxableIncome: 55_800,
    label: 'joint standard deduction plus two senior deductions',
    options: { age65Plus: true, partnerAge65Plus: true },
    citation: `${IRS_REV_PROC_2025_32}; ${IRS_OBBBA_SENIOR_DEDUCTION}; ${IRC_151_SENIOR_DEDUCTION}`,
  },
  {
    filingStatus: 'hoh',
    agi: 50_000,
    expectedTaxableIncome: 19_850,
    label: 'head of household standard deduction plus one senior deduction',
    options: { age65Plus: true },
    citation: `${IRS_REV_PROC_2025_32}; ${IRS_OBBBA_SENIOR_DEDUCTION}; ${IRC_151_SENIOR_DEDUCTION}`,
  },
  {
    filingStatus: 'mfs',
    agi: 50_000,
    expectedTaxableIncome: 33_900,
    label: 'married filing separately is not eligible for senior deduction',
    options: { age65Plus: true, partnerAge65Plus: true },
    citation: `${IRS_REV_PROC_2025_32}; ${IRS_OBBBA_SENIOR_DEDUCTION}`,
  },
  {
    filingStatus: 'single',
    agi: 100_000,
    expectedTaxableIncome: 79_400,
    label: 'single senior deduction partially phases out using AGI as MAGI',
    options: { age65Plus: true },
    citation: `${IRS_REV_PROC_2025_32}; ${IRS_OBBBA_SENIOR_DEDUCTION}; ${IRC_151_SENIOR_DEDUCTION}`,
  },
  {
    filingStatus: 'mfj',
    agi: 250_000,
    expectedTaxableIncome: 211_800,
    label: 'joint senior deduction phaseout applies per qualified person using supplied MAGI',
    options: { age65Plus: true, partnerAge65Plus: true, magi: 200_000 },
    citation: `${IRS_REV_PROC_2025_32}; ${IRS_OBBBA_SENIOR_DEDUCTION}; ${IRC_151_SENIOR_DEDUCTION}`,
  },
  {
    filingStatus: 'single',
    agi: 10_000,
    expectedTaxableIncome: 0,
    label: 'deductions greater than AGI floor taxable income at zero',
    options: { age65Plus: true },
    citation: `${IRS_REV_PROC_2025_32}; ${IRS_OBBBA_SENIOR_DEDUCTION}`,
  },
  {
    filingStatus: 'hoh',
    agi: 0,
    expectedTaxableIncome: 0,
    label: 'zero AGI floors taxable income at zero',
    citation: IRS_REV_PROC_2025_32,
  },
];

describe('2026 federal ordinary tax fixtures', () => {
  it.each(ordinaryTaxFixtures)('$filingStatus $label', ({ filingStatus, taxableIncome, expectedTax, citation }) => {
    expect(citation).toContain('Rev. Proc. 2025-32');
    expect(computeFederalTax(taxableIncome, filingStatus, CONSTANTS_2026.federal.ordinaryBrackets)).toBe(expectedTax);
  });
});

describe('2026 taxable income deduction fixtures', () => {
  it.each(taxableIncomeFixtures)('$filingStatus $label', ({ filingStatus, agi, options, expectedTaxableIncome, citation }) => {
    expect(citation).toMatch(/Rev\. Proc\. 2025-32|OBBBA|151\(d\)\(5\)\(C\)/);
    expect(computeTaxableIncome(agi, filingStatus, options)).toBe(expectedTaxableIncome);
  });
});
