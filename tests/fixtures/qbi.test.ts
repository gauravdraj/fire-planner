import { describe, expect, it } from 'vitest';

import { computeQbi } from '@/core/tax/qbi';
import type { FilingStatus } from '@/core/types';

const IRC_199A =
  '26 U.S.C. § 199A, qualified business income deduction rate, SSTB limitations, and W-2/UBIA limits, https://uscode.house.gov/view.xhtml?req=(title:26%20section:199A%20edition:prelim)';
const IRS_REV_PROC_2025_32 =
  'IRS Rev. Proc. 2025-32 §4.26, 2026 section 199A threshold amounts and phase-in range amounts, https://www.irs.gov/pub/irs-drop/rp-25-32.pdf';
const IRS_FORM_8995_2025 =
  'IRS Instructions for Form 8995 (2025), lines 11-15 taxable-income-minus-net-capital-gain limitation, https://www.irs.gov/instructions/i8995';
const IRS_FORM_8995_A_2025 =
  'IRS Instructions for Form 8995-A (2025), Schedule A SSTB applicable percentage and Part III W-2/UBIA limitation mechanics, https://www.irs.gov/instructions/i8995a';

type QbiFixture = {
  label: string;
  input: {
    qbiNetIncome: number;
    sstb: boolean;
    taxableIncomeBeforeQbi: number;
    netCapitalGains: number;
    filingStatus: FilingStatus;
    w2WagesAggregated?: number;
    ubiaAggregated?: number;
  };
  expectedDeduction: number;
  worksheetWalk: string;
  citations: readonly string[];
};

/*
 * Expected values are hand-entered Form 8995 / Form 8995-A worksheet walks
 * using primary-source 2026 section 199A thresholds. They are not imported from
 * production code or derived from CONSTANTS_2026.
 */
const qbiFixtures: readonly QbiFixture[] = [
  {
    label: 'below threshold uses lesser of 20% QBI or 20% taxable income less net capital gain',
    input: {
      qbiNetIncome: 100_000,
      sstb: false,
      taxableIncomeBeforeQbi: 150_000,
      netCapitalGains: 0,
      filingStatus: 'single',
    },
    expectedDeduction: 20_000,
    worksheetWalk:
      'Form 8995 simplified walk: single taxable income 150,000 is below the 201,750 threshold. 20% of QBI is 20,000; 20% of taxable income less net capital gain is 30,000; deduction is 20,000.',
    citations: [IRC_199A, IRS_REV_PROC_2025_32, IRS_FORM_8995_2025],
  },
  {
    label: 'SSTB halfway through phaseout receives half of otherwise allowable deduction',
    input: {
      qbiNetIncome: 100_000,
      sstb: true,
      taxableIncomeBeforeQbi: 239_250,
      netCapitalGains: 0,
      filingStatus: 'single',
    },
    expectedDeduction: 10_000,
    worksheetWalk:
      'Form 8995-A Schedule A walk: single SSTB phaseout starts at 201,750 and ends at 276,750. Taxable income 239,250 is 37,500 into the 75,000 range, so 50% remains. 20% of 100,000 QBI is 20,000; 50% allowed is 10,000; taxable-income cap is 47,850.',
    citations: [IRC_199A, IRS_REV_PROC_2025_32, IRS_FORM_8995_A_2025],
  },
  {
    label: 'SSTB above phaseout end receives zero deduction',
    input: {
      qbiNetIncome: 100_000,
      sstb: true,
      taxableIncomeBeforeQbi: 300_000,
      netCapitalGains: 0,
      filingStatus: 'single',
    },
    expectedDeduction: 0,
    worksheetWalk:
      'Form 8995-A SSTB walk: single taxable income 300,000 exceeds the 276,750 phaseout end, so no SSTB QBI is treated as qualified business income for the deduction.',
    citations: [IRC_199A, IRS_REV_PROC_2025_32, IRS_FORM_8995_A_2025],
  },
  {
    label: 'non-SSTB above threshold is capped by 50% of W-2 wages',
    input: {
      qbiNetIncome: 200_000,
      sstb: false,
      taxableIncomeBeforeQbi: 600_000,
      netCapitalGains: 0,
      filingStatus: 'mfj',
      w2WagesAggregated: 40_000,
      ubiaAggregated: 0,
    },
    expectedDeduction: 20_000,
    worksheetWalk:
      'Form 8995-A W-2 limitation walk: MFJ taxable income 600,000 is above the 553,500 upper range. 20% of QBI is 40,000. The greater wage/property limit is max(50% of 40,000 = 20,000, 25% of 40,000 plus 2.5% of 0 = 10,000), so the QBI component is 20,000; taxable-income cap is 120,000.',
    citations: [IRC_199A, IRS_REV_PROC_2025_32, IRS_FORM_8995_A_2025],
  },
  {
    label: 'non-SSTB above threshold uses the 25% W-2 wages plus 2.5% UBIA cap when larger',
    input: {
      qbiNetIncome: 200_000,
      sstb: false,
      taxableIncomeBeforeQbi: 300_000,
      netCapitalGains: 0,
      filingStatus: 'single',
      w2WagesAggregated: 20_000,
      ubiaAggregated: 1_000_000,
    },
    expectedDeduction: 30_000,
    worksheetWalk:
      'Form 8995-A UBIA limitation walk: single taxable income 300,000 is above the 276,750 upper range. 20% of QBI is 40,000. The greater wage/property limit is max(50% of 20,000 = 10,000, 25% of 20,000 plus 2.5% of 1,000,000 = 30,000), so the QBI component is 30,000; taxable-income cap is 60,000.',
    citations: [IRC_199A, IRS_REV_PROC_2025_32, IRS_FORM_8995_A_2025],
  },
  {
    label: 'taxable-income-minus-net-capital-gains cap limits the deduction',
    input: {
      qbiNetIncome: 100_000,
      sstb: false,
      taxableIncomeBeforeQbi: 120_000,
      netCapitalGains: 100_000,
      filingStatus: 'single',
    },
    expectedDeduction: 4_000,
    worksheetWalk:
      'Form 8995 lines 11-15 walk: taxable income before QBI deduction is 120,000 and net capital gain is 100,000, leaving 20,000. The taxable-income limitation is 20% of 20,000 = 4,000, which is less than 20% of 100,000 QBI.',
    citations: [IRC_199A, IRS_FORM_8995_2025],
  },
];

describe('2026 simplified section 199A QBI fixtures', () => {
  it('contains the requested fixture breadth', () => {
    expect(qbiFixtures.some(({ label }) => label.includes('below threshold'))).toBe(true);
    expect(qbiFixtures.some(({ label }) => label.includes('SSTB halfway'))).toBe(true);
    expect(qbiFixtures.some(({ label }) => label.includes('SSTB above'))).toBe(true);
    expect(qbiFixtures.some(({ label }) => label.includes('50% of W-2 wages'))).toBe(true);
    expect(qbiFixtures.some(({ label }) => label.includes('UBIA cap'))).toBe(true);
    expect(qbiFixtures.some(({ label }) => label.includes('net-capital-gains cap'))).toBe(true);
  });

  it.each(qbiFixtures)('$label', ({ citations, expectedDeduction, input, worksheetWalk }) => {
    const citationText = citations.join('; ');
    expect(citationText).toMatch(/199A|Form 8995/);
    expect(worksheetWalk).toMatch(/20%|SSTB|W-2|UBIA|net capital gain/);

    expect(computeQbi(input)).toBe(expectedDeduction);
  });
});
