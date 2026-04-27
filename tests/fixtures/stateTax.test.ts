import { describe, expect, it } from 'vitest';

import { CALIFORNIA_STATE_TAX } from '@/core/constants/states/california';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import { PENNSYLVANIA_STATE_TAX } from '@/core/constants/states/pennsylvania';
import { computeStateTax, type StateIncomeTaxLaw } from '@/core/tax/state';
import type { FilingStatus } from '@/core/types';

const FLORIDA_DOR_INDIVIDUAL_INCOME_TAX =
  'Florida Department of Revenue FAQ, State of Florida does not have an income tax for individuals, retrieved 2026-04-26, https://floridarevenue.com/faq/Pages/FAQDetails.aspx?FAQID=1307&IsDlg=1';
const PA_DOR_PERSONAL_INCOME_TAX =
  'Pennsylvania Department of Revenue, Personal Income Tax overview, 3.07 percent rate, retrieved 2026-04-26, https://www.revenue.pa.gov/TaxTypes/PIT/Pages/default.aspx';
const CA_FTB_2025_TAX_TABLE =
  'California Franchise Tax Board, 2025 California Tax Table for Form 540 line 19 taxable income, retrieved 2026-04-26, https://www.ftb.ca.gov/forms/2025/2025-540-taxtable.pdf';
const CA_FTB_2025_TAX_RATE_SCHEDULES =
  'California Franchise Tax Board, 2025 Form 540 Personal Income Tax Booklet, Tax Rate Schedules, retrieved 2026-04-26, https://www.ftb.ca.gov/forms/2025/2025-540-booklet.html#Tax-Rate-Schedules';

type StateTaxFixture = Readonly<{
  name: string;
  law: StateIncomeTaxLaw;
  filingStatus: FilingStatus;
  taxableIncome: number;
  expectedTax: number;
  expectedWholeDollarTax?: number;
  citation: string;
  worksheetWalk: string;
}>;

const fixtures = [
  {
    name: 'Florida resident with positive taxable income',
    law: FLORIDA_STATE_TAX,
    filingStatus: 'single',
    taxableIncome: 250_000,
    expectedTax: 0,
    citation: FLORIDA_DOR_INDIVIDUAL_INCOME_TAX,
    worksheetWalk:
      'Florida DOR states that Florida does not have an income tax for individuals. Any positive individual taxable income in this starter resident model therefore produces $0.00 Florida income tax.',
  },
  {
    name: 'Pennsylvania $100,000 flat-rate example',
    law: PENNSYLVANIA_STATE_TAX,
    filingStatus: 'mfj',
    taxableIncome: 100_000,
    expectedTax: 3_070,
    citation: PA_DOR_PERSONAL_INCOME_TAX,
    worksheetWalk:
      'Pennsylvania DOR states that personal income tax is levied at 3.07 percent against taxable income. $100,000.00 * 0.0307 = $3,070.00.',
  },
  {
    name: 'California single filer at $50,000 taxable income',
    law: CALIFORNIA_STATE_TAX,
    filingStatus: 'single',
    taxableIncome: 50_000,
    expectedTax: 1_534.89,
    expectedWholeDollarTax: 1_535,
    citation: `${CA_FTB_2025_TAX_TABLE}; ${CA_FTB_2025_TAX_RATE_SCHEDULES}`,
    worksheetWalk:
      'FTB 2025 tax table row $49,951-$50,050 lists $1,535 for filing status 1 or 3. The exact Schedule X cents are $1,022.01 + 6.00% of ($50,000 - $41,452) = $1,534.89, which rounds to the table amount.',
  },
  {
    name: 'California married filing jointly filer at $200,000 taxable income',
    law: CALIFORNIA_STATE_TAX,
    filingStatus: 'mfj',
    taxableIncome: 200_000,
    expectedTax: 11_477.28,
    citation: CA_FTB_2025_TAX_RATE_SCHEDULES,
    worksheetWalk:
      'The FTB tax table says taxable income over $100,000 must use the tax-rate schedules. Schedule Y gives $6,403.94 + 9.30% of ($200,000 - $145,448) = $11,477.276, rounded half-up to $11,477.28.',
  },
] satisfies readonly StateTaxFixture[];

function expectFixtureSourceMetadata(fixture: StateTaxFixture): void {
  expect(fixture.citation).toContain('retrieved 2026-04-26');
  expect(fixture.citation).toContain('https://');
  expect(fixture.worksheetWalk).toContain('$');
}

describe('state tax source-backed fixture suite', () => {
  it.each(fixtures)('computes $name', (fixture) => {
    expectFixtureSourceMetadata(fixture);

    const actualTax = computeStateTax({
      law: fixture.law,
      filingStatus: fixture.filingStatus,
      taxableIncome: fixture.taxableIncome,
    });

    expect(actualTax).toBe(fixture.expectedTax);

    if (fixture.expectedWholeDollarTax !== undefined) {
      expect(Math.round(actualTax)).toBe(fixture.expectedWholeDollarTax);
    }
  });
});
