import { describe, expect, it } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import { computeFederalTax } from '@/core/tax/federal';
import { computeLtcgTax } from '@/core/tax/ltcg';
import { computeNiit } from '@/core/tax/niit';
import type { FilingStatus } from '@/core/types';

const IRS_REV_PROC_2025_32 =
  'IRS Rev. Proc. 2025-32, 2026 inflation-adjusted tax items, ordinary income brackets and qualified dividend / capital gain thresholds, https://www.irs.gov/pub/irs-drop/rp-25-32.pdf';
const IRS_FORM_1040_TAX_COMPUTATION_WORKSHEET =
  'IRS Form 1040 Instructions, Tax Computation Worksheet for line 16 ordinary tax mechanics, https://www.irs.gov/instructions/i1040gi';
const IRS_SCHEDULE_D_TAX_WORKSHEET =
  'IRS Form 1040 Instructions, Schedule D Tax Worksheet for qualified dividends and capital gain tax, https://www.irs.gov/instructions/i1040gi';
const IRS_NIIT =
  'IRS Net Investment Income Tax guidance, 3.8% tax on lesser of net investment income or MAGI over threshold, https://www.irs.gov/individuals/net-investment-income-tax';

type LtcgStackingCase = {
  label: string;
  filingStatus: FilingStatus;
  ordinaryTaxableIncome: number;
  ltcgAndQdiv: number;
  magiForNiit: number;
  netInvestmentIncome: number;
  expectedOrdinaryTax: number;
  expectedLtcgTax: number;
  expectedNiit: number;
  worksheetWalk: string;
  citations: readonly string[];
};

/*
 * Expected values are hand-entered from independent worksheet walks using the
 * primary-source thresholds cited beside each case. They are not calculated
 * from production functions or derived from CONSTANTS_2026.
 */
const ltcgStackingCases: readonly LtcgStackingCase[] = [
  {
    label: 'single all LTCG/QDIV stays in the 0% band',
    filingStatus: 'single',
    ordinaryTaxableIncome: 20_000,
    ltcgAndQdiv: 20_000,
    magiForNiit: 60_000,
    netInvestmentIncome: 20_000,
    expectedOrdinaryTax: 2_152,
    expectedLtcgTax: 0,
    expectedNiit: 0,
    worksheetWalk:
      'Ordinary tax: 12,400 x 10% + 7,600 x 12% = 2,152. Schedule D: 20,000 preferential income stacked on 20,000 ordinary taxable income remains below the 49,450 single 0% ceiling. NIIT: 60,000 MAGI is below the 200,000 single threshold.',
    citations: [IRS_REV_PROC_2025_32, IRS_FORM_1040_TAX_COMPUTATION_WORKSHEET, IRS_SCHEDULE_D_TAX_WORKSHEET, IRS_NIIT],
  },
  {
    label: 'single LTCG/QDIV straddles the 0% and 15% bands',
    filingStatus: 'single',
    ordinaryTaxableIncome: 40_000,
    ltcgAndQdiv: 20_000,
    magiForNiit: 80_000,
    netInvestmentIncome: 20_000,
    expectedOrdinaryTax: 4_552,
    expectedLtcgTax: 1_582.5,
    expectedNiit: 0,
    worksheetWalk:
      'Ordinary tax: 12,400 x 10% + 27,600 x 12% = 4,552. Schedule D: 9,450 fills the remaining single 0% band and 10,550 x 15% = 1,582.50. NIIT: 80,000 MAGI is below the 200,000 single threshold.',
    citations: [IRS_REV_PROC_2025_32, IRS_FORM_1040_TAX_COMPUTATION_WORKSHEET, IRS_SCHEDULE_D_TAX_WORKSHEET, IRS_NIIT],
  },
  {
    label: 'single ordinary income fully consumes the 0% band so LTCG/QDIV starts at 15%',
    filingStatus: 'single',
    ordinaryTaxableIncome: 60_000,
    ltcgAndQdiv: 10_000,
    magiForNiit: 110_000,
    netInvestmentIncome: 10_000,
    expectedOrdinaryTax: 7_912,
    expectedLtcgTax: 1_500,
    expectedNiit: 0,
    worksheetWalk:
      'Ordinary tax: 12,400 x 10% + 38,000 x 12% + 9,600 x 22% = 7,912. Schedule D: ordinary taxable income exceeds the 49,450 single 0% ceiling, so 10,000 x 15% = 1,500. NIIT: 110,000 MAGI is below the 200,000 single threshold.',
    citations: [IRS_REV_PROC_2025_32, IRS_FORM_1040_TAX_COMPUTATION_WORKSHEET, IRS_SCHEDULE_D_TAX_WORKSHEET, IRS_NIIT],
  },
  {
    label: 'single LTCG/QDIV straddles the 15% and 20% bands and triggers NIIT',
    filingStatus: 'single',
    ordinaryTaxableIncome: 545_000,
    ltcgAndQdiv: 2_000,
    magiForNiit: 547_000,
    netInvestmentIncome: 2_000,
    expectedOrdinaryTax: 159_519.25,
    expectedLtcgTax: 375,
    expectedNiit: 76,
    worksheetWalk:
      'Ordinary tax: tax through 256,225 is 58,448 plus 288,775 x 35% = 159,519.25. Schedule D: 500 remains in the single 15% band and 1,500 is in the 20% band, for 75 + 300 = 375. NIIT: lesser of 2,000 NII or 347,000 MAGI excess is 2,000; 2,000 x 3.8% = 76.',
    citations: [IRS_REV_PROC_2025_32, IRS_FORM_1040_TAX_COMPUTATION_WORKSHEET, IRS_SCHEDULE_D_TAX_WORKSHEET, IRS_NIIT],
  },
  {
    label: 'MFJ LTCG/QDIV straddles the 0% and 15% bands',
    filingStatus: 'mfj',
    ordinaryTaxableIncome: 90_000,
    ltcgAndQdiv: 20_000,
    magiForNiit: 140_000,
    netInvestmentIncome: 20_000,
    expectedOrdinaryTax: 10_304,
    expectedLtcgTax: 1_665,
    expectedNiit: 0,
    worksheetWalk:
      'Ordinary tax: 24,800 x 10% + 65,200 x 12% = 10,304. Schedule D: 8,900 fills the remaining MFJ 0% band and 11,100 x 15% = 1,665. NIIT: 140,000 MAGI is below the 250,000 MFJ threshold.',
    citations: [IRS_REV_PROC_2025_32, IRS_FORM_1040_TAX_COMPUTATION_WORKSHEET, IRS_SCHEDULE_D_TAX_WORKSHEET, IRS_NIIT],
  },
  {
    label: 'MFJ LTCG/QDIV straddles the 15% and 20% bands and triggers NIIT',
    filingStatus: 'mfj',
    ordinaryTaxableIncome: 600_000,
    ltcgAndQdiv: 20_000,
    magiForNiit: 620_000,
    netInvestmentIncome: 20_000,
    expectedOrdinaryTax: 147_538.5,
    expectedLtcgTax: 3_315,
    expectedNiit: 760,
    worksheetWalk:
      'Ordinary tax: tax through 512,450 is 116,896 plus 87,550 x 35% = 147,538.50. Schedule D: 13,700 remains in the MFJ 15% band and 6,300 is in the 20% band, for 2,055 + 1,260 = 3,315. NIIT: lesser of 20,000 NII or 370,000 MAGI excess is 20,000; 20,000 x 3.8% = 760.',
    citations: [IRS_REV_PROC_2025_32, IRS_FORM_1040_TAX_COMPUTATION_WORKSHEET, IRS_SCHEDULE_D_TAX_WORKSHEET, IRS_NIIT],
  },
  {
    label: 'HOH ordinary income fully consumes the 0% band so LTCG/QDIV starts at 15%',
    filingStatus: 'hoh',
    ordinaryTaxableIncome: 70_000,
    ltcgAndQdiv: 5_000,
    magiForNiit: 95_000,
    netInvestmentIncome: 5_000,
    expectedOrdinaryTax: 8_301,
    expectedLtcgTax: 750,
    expectedNiit: 0,
    worksheetWalk:
      'Ordinary tax: 17,700 x 10% + 49,750 x 12% + 2,550 x 22% = 8,301. Schedule D: ordinary taxable income exceeds the 66,200 HOH 0% ceiling, so 5,000 x 15% = 750. NIIT: 95,000 MAGI is below the 200,000 HOH threshold.',
    citations: [IRS_REV_PROC_2025_32, IRS_FORM_1040_TAX_COMPUTATION_WORKSHEET, IRS_SCHEDULE_D_TAX_WORKSHEET, IRS_NIIT],
  },
  {
    label: 'MFS LTCG/QDIV is entirely in the 20% band and triggers NIIT',
    filingStatus: 'mfs',
    ordinaryTaxableIncome: 310_000,
    ltcgAndQdiv: 5_000,
    magiForNiit: 315_000,
    netInvestmentIncome: 5_000,
    expectedOrdinaryTax: 77_269.25,
    expectedLtcgTax: 1_000,
    expectedNiit: 190,
    worksheetWalk:
      'Ordinary tax: tax through 256,225 is 58,448 plus 53,775 x 35% = 77,269.25. Schedule D: ordinary taxable income exceeds the 306,850 MFS 20% threshold, so 5,000 x 20% = 1,000. NIIT: lesser of 5,000 NII or 190,000 MAGI excess is 5,000; 5,000 x 3.8% = 190.',
    citations: [IRS_REV_PROC_2025_32, IRS_FORM_1040_TAX_COMPUTATION_WORKSHEET, IRS_SCHEDULE_D_TAX_WORKSHEET, IRS_NIIT],
  },
];

describe('2026 LTCG stacking, ordinary tax, and NIIT fixtures', () => {
  it('contains the requested worksheet breadth', () => {
    expect(ltcgStackingCases.length).toBeGreaterThanOrEqual(8);
    expect(ltcgStackingCases.filter(({ expectedNiit }) => expectedNiit > 0).length).toBeGreaterThanOrEqual(2);
    expect(ltcgStackingCases.some(({ label }) => label.includes('straddles'))).toBe(true);
    expect(ltcgStackingCases.some(({ label }) => label.includes('fully consumes'))).toBe(true);
  });

  it.each(ltcgStackingCases)(
    '$filingStatus $label',
    ({
      citations,
      expectedLtcgTax,
      expectedNiit,
      expectedOrdinaryTax,
      filingStatus,
      ltcgAndQdiv,
      magiForNiit,
      netInvestmentIncome,
      ordinaryTaxableIncome,
      worksheetWalk,
    }) => {
      const citationText = citations.join('; ');
      expect(citationText).toContain('Rev. Proc. 2025-32');
      expect(citationText).toContain('Tax Computation Worksheet');
      expect(citationText).toContain('Schedule D Tax Worksheet');
      expect(citationText).toContain('Net Investment Income Tax');
      expect(worksheetWalk).toMatch(/Ordinary tax: .* Schedule D: .* NIIT:/);

      expect(computeFederalTax(ordinaryTaxableIncome, filingStatus, CONSTANTS_2026.federal.ordinaryBrackets)).toBe(
        expectedOrdinaryTax,
      );
      expect(computeLtcgTax({ ordinaryTaxableIncome, ltcgAndQdiv, filingStatus }).ltcgTax).toBe(expectedLtcgTax);
      expect(computeNiit({ filingStatus, magiForNiit, netInvestmentIncome })).toBe(expectedNiit);
    },
  );
});
