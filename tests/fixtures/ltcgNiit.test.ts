import { describe, expect, it } from 'vitest';

import { computeLtcgTax } from '@/core/tax/ltcg';
import { computeNiit } from '@/core/tax/niit';
import type { FilingStatus } from '@/core/types';

const IRS_REV_PROC_2025_32 =
  'IRS Rev. Proc. 2025-32, 2026 inflation-adjusted tax items, long-term capital gains thresholds, https://www.irs.gov/pub/irs-drop/rp-25-32.pdf';
const IRS_SCHEDULE_D_WORKSHEET =
  'IRS Form 1040 Instructions, Schedule D Tax Worksheet stacking mechanics, https://www.irs.gov/instructions/i1040gi';
const IRS_NIIT =
  'IRS Net Investment Income Tax guidance, https://www.irs.gov/individuals/net-investment-income-tax';

type LtcgFixture = {
  label: string;
  filingStatus: FilingStatus;
  ordinaryTaxableIncome: number;
  ltcgAndQdiv: number;
  expectedTax: number;
  expectedAmountsByRate: Record<string, number>;
  expectedTaxByRate: Record<string, number>;
  citation: string;
};

type NiitFixture = {
  label: string;
  filingStatus: FilingStatus;
  magiForNiit: number;
  netInvestmentIncome: number;
  expectedNiit: number;
  citation: string;
};

/*
 * Expected LTCG values are hand-entered Schedule D worksheet walks using the
 * Rev. Proc. 2025-32 2026 0% / 15% / 20% thresholds. Ordinary taxable income
 * occupies lower preferential-rate bracket space before LTCG/QDIV is applied.
 */
const ltcgFixtures: readonly LtcgFixture[] = [
  {
    label: 'single ordinary income partially fills the 0% band',
    filingStatus: 'single',
    ordinaryTaxableIncome: 40_000,
    ltcgAndQdiv: 20_000,
    expectedTax: 1_582.5,
    expectedAmountsByRate: { '0': 9_450, '0.15': 10_550, '0.2': 0 },
    expectedTaxByRate: { '0': 0, '0.15': 1_582.5, '0.2': 0 },
    citation: `${IRS_REV_PROC_2025_32}; ${IRS_SCHEDULE_D_WORKSHEET}`,
  },
  {
    label: 'single LTCG ending exactly at the 15% threshold remains in the 0% band',
    filingStatus: 'single',
    ordinaryTaxableIncome: 40_000,
    ltcgAndQdiv: 9_450,
    expectedTax: 0,
    expectedAmountsByRate: { '0': 9_450, '0.15': 0, '0.2': 0 },
    expectedTaxByRate: { '0': 0, '0.15': 0, '0.2': 0 },
    citation: `${IRS_REV_PROC_2025_32}; ${IRS_SCHEDULE_D_WORKSHEET}`,
  },
  {
    label: 'single LTCG starting exactly at the 15% threshold is taxed at 15%',
    filingStatus: 'single',
    ordinaryTaxableIncome: 49_450,
    ltcgAndQdiv: 100,
    expectedTax: 15,
    expectedAmountsByRate: { '0': 0, '0.15': 100, '0.2': 0 },
    expectedTaxByRate: { '0': 0, '0.15': 15, '0.2': 0 },
    citation: `${IRS_REV_PROC_2025_32}; ${IRS_SCHEDULE_D_WORKSHEET}`,
  },
  {
    label: 'single LTCG crosses from 15% into 20%',
    filingStatus: 'single',
    ordinaryTaxableIncome: 545_000,
    ltcgAndQdiv: 1_000,
    expectedTax: 175,
    expectedAmountsByRate: { '0': 0, '0.15': 500, '0.2': 500 },
    expectedTaxByRate: { '0': 0, '0.15': 75, '0.2': 100 },
    citation: `${IRS_REV_PROC_2025_32}; ${IRS_SCHEDULE_D_WORKSHEET}`,
  },
  {
    label: 'MFJ ordinary income partially fills the 15% band before 20% applies',
    filingStatus: 'mfj',
    ordinaryTaxableIncome: 600_000,
    ltcgAndQdiv: 20_000,
    expectedTax: 3_315,
    expectedAmountsByRate: { '0': 0, '0.15': 13_700, '0.2': 6_300 },
    expectedTaxByRate: { '0': 0, '0.15': 2_055, '0.2': 1_260 },
    citation: `${IRS_REV_PROC_2025_32}; ${IRS_SCHEDULE_D_WORKSHEET}`,
  },
];

const niitFixtures: readonly NiitFixture[] = [
  {
    label: 'single MAGI below threshold owes no NIIT',
    filingStatus: 'single',
    magiForNiit: 199_999,
    netInvestmentIncome: 10_000,
    expectedNiit: 0,
    citation: IRS_NIIT,
  },
  {
    label: 'single NIIT is limited by MAGI excess',
    filingStatus: 'single',
    magiForNiit: 210_000,
    netInvestmentIncome: 50_000,
    expectedNiit: 380,
    citation: IRS_NIIT,
  },
  {
    label: 'MFJ NIIT is limited by net investment income',
    filingStatus: 'mfj',
    magiForNiit: 500_000,
    netInvestmentIncome: 100_000,
    expectedNiit: 3_800,
    citation: IRS_NIIT,
  },
  {
    label: 'HOH NIIT uses the single/head-of-household statutory threshold',
    filingStatus: 'hoh',
    magiForNiit: 205_000,
    netInvestmentIncome: 1_000,
    expectedNiit: 38,
    citation: IRS_NIIT,
  },
  {
    label: 'MFS NIIT uses the separate statutory threshold and rounds to cents',
    filingStatus: 'mfs',
    magiForNiit: 125_123.45,
    netInvestmentIncome: 500,
    expectedNiit: 4.69,
    citation: IRS_NIIT,
  },
];

describe('2026 LTCG and qualified dividend stacking fixtures', () => {
  it.each(ltcgFixtures)(
    '$filingStatus $label',
    ({
      citation,
      expectedAmountsByRate,
      expectedTax,
      expectedTaxByRate,
      filingStatus,
      ltcgAndQdiv,
      ordinaryTaxableIncome,
    }) => {
      expect(citation).toContain('Rev. Proc. 2025-32');

      const result = computeLtcgTax({
        filingStatus,
        ltcgAndQdiv,
        ordinaryTaxableIncome,
      });

      expect(result.ltcgTax).toBe(expectedTax);
      expect(Object.fromEntries(result.bracketBreakdown.map(({ rate, taxableAmount }) => [String(rate), taxableAmount]))).toEqual(
        expectedAmountsByRate,
      );
      expect(Object.fromEntries(result.bracketBreakdown.map(({ rate, tax }) => [String(rate), tax]))).toEqual(expectedTaxByRate);
    },
  );
});

describe('NIIT fixtures', () => {
  it.each(niitFixtures)(
    '$filingStatus $label',
    ({ citation, expectedNiit, filingStatus, magiForNiit, netInvestmentIncome }) => {
      expect(citation).toContain('Net Investment Income Tax');

      expect(computeNiit({ filingStatus, magiForNiit, netInvestmentIncome })).toBe(expectedNiit);
    },
  );
});
