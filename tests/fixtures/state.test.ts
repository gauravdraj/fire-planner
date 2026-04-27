import { describe, expect, it } from 'vitest';

import { CALIFORNIA_STATE_TAX } from '@/core/constants/states/california';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import { PENNSYLVANIA_STATE_TAX } from '@/core/constants/states/pennsylvania';
import { computeStateTax } from '@/core/tax/state';
import type { FilingStatus } from '@/core/types';

const FLORIDA_DOR_INDIVIDUAL_INCOME_TAX =
  'Florida Department of Revenue FAQ, State of Florida does not have an income tax for individuals, retrieved 2026-04-26, https://floridarevenue.com/faq/Pages/FAQDetails.aspx?FAQID=1307&IsDlg=1';
const PA_DOR_PERSONAL_INCOME_TAX =
  'Pennsylvania Department of Revenue, Personal Income Tax overview, 3.07 percent rate, retrieved 2026-04-26, https://www.revenue.pa.gov/TaxTypes/PIT/Pages/default.aspx';
const CA_FTB_2025_TAX_RATE_SCHEDULES =
  'California Franchise Tax Board, 2025 Form 540 Personal Income Tax Booklet, Tax Rate Schedules, retrieved 2026-04-26, https://www.ftb.ca.gov/forms/2025/2025-540-booklet.html#Tax-Rate-Schedules';

type CaliforniaFixture = Readonly<{
  filingStatus: FilingStatus;
  taxableIncome: number;
  expectedTax: number;
  citation: string;
  worksheetWalk: string;
}>;

const californiaFixtures = [
  {
    filingStatus: 'single',
    taxableIncome: 11_079,
    expectedTax: 110.79,
    citation: CA_FTB_2025_TAX_RATE_SCHEDULES,
    worksheetWalk: 'Schedule X: $0.00 + 1.00% of $11,079 = $110.79.',
  },
  {
    filingStatus: 'mfs',
    taxableIncome: 445_771,
    expectedTax: 38_638.27,
    citation: CA_FTB_2025_TAX_RATE_SCHEDULES,
    worksheetWalk: 'Schedule X: $30,986.19 + 10.30% of ($445,771 - $371,479) = $38,638.27.',
  },
  {
    filingStatus: 'mfj',
    taxableIncome: 125_000,
    expectedTax: 4_768.1,
    citation: CA_FTB_2025_TAX_RATE_SCHEDULES,
    worksheetWalk: 'Schedule Y FTB example: $3,974.82 + 8.00% of ($125,000 - $115,084) = $4,768.10.',
  },
  {
    filingStatus: 'hoh',
    taxableIncome: 1_010_418,
    expectedTax: 97_473.03,
    citation: CA_FTB_2025_TAX_RATE_SCHEDULES,
    worksheetWalk: 'Schedule Z top bracket: $97,472.91 + 12.30% of ($1,010,418 - $1,010,417) = $97,473.03.',
  },
] satisfies readonly CaliforniaFixture[];

function expectFrozen(value: object): void {
  expect(Object.isFrozen(value)).toBe(true);
}

describe('starter state tax constants', () => {
  it('exports source-backed frozen Florida no-income-tax law', () => {
    expect(FLORIDA_DOR_INDIVIDUAL_INCOME_TAX).toContain('Florida Department of Revenue');
    expectFrozen(FLORIDA_STATE_TAX);
    expect(FLORIDA_STATE_TAX).toMatchObject({
      stateCode: 'FL',
      taxYear: 2026,
      kind: 'none',
      retrievedAt: '2026-04-26',
    });
    expect(FLORIDA_STATE_TAX.source).toContain('floridarevenue.com');
  });

  it('exports source-backed frozen Pennsylvania flat-rate law', () => {
    expect(PA_DOR_PERSONAL_INCOME_TAX).toContain('3.07 percent');
    expectFrozen(PENNSYLVANIA_STATE_TAX);
    expect(PENNSYLVANIA_STATE_TAX).toMatchObject({
      stateCode: 'PA',
      taxYear: 2026,
      kind: 'flat',
      rate: 0.0307,
      retrievedAt: '2026-04-26',
    });
    expect(PENNSYLVANIA_STATE_TAX.source).toContain('revenue.pa.gov');
  });

  it('exports source-backed frozen California bracketed law', () => {
    expect(CA_FTB_2025_TAX_RATE_SCHEDULES).toContain('Franchise Tax Board');
    expectFrozen(CALIFORNIA_STATE_TAX);
    expectFrozen(CALIFORNIA_STATE_TAX.brackets);
    expectFrozen(CALIFORNIA_STATE_TAX.brackets.single);
    expect(CALIFORNIA_STATE_TAX).toMatchObject({
      stateCode: 'CA',
      taxYear: 2025,
      kind: 'bracketed',
      retrievedAt: '2026-04-26',
    });
    expect(CALIFORNIA_STATE_TAX.brackets.single[0]).toEqual({ from: 0, upTo: 11_079, baseTax: 0, rate: 0.01 });
    expect(CALIFORNIA_STATE_TAX.brackets.mfj.at(-1)).toEqual({
      from: 1_485_906,
      baseTax: 144_439.65,
      rate: 0.123,
    });
  });
});

describe('computeStateTax fixtures', () => {
  it('returns zero for Florida taxable income', () => {
    expect(FLORIDA_DOR_INDIVIDUAL_INCOME_TAX).toContain('does not have an income tax');
    expect(computeStateTax({ law: FLORIDA_STATE_TAX, filingStatus: 'single', taxableIncome: 250_000 })).toBe(0);
  });

  it('computes Pennsylvania flat tax at 3.07 percent', () => {
    expect(PA_DOR_PERSONAL_INCOME_TAX).toContain('3.07 percent');
    expect(computeStateTax({ law: PENNSYLVANIA_STATE_TAX, filingStatus: 'mfj', taxableIncome: 100_000 })).toBe(3_070);
    expect(computeStateTax({ law: PENNSYLVANIA_STATE_TAX, filingStatus: 'single', taxableIncome: 12_345.67 })).toBe(
      379.01,
    );
  });

  it.each(californiaFixtures)(
    'computes California $filingStatus bracketed tax on $taxableIncome',
    ({ filingStatus, taxableIncome, expectedTax, citation, worksheetWalk }) => {
      expect(citation).toContain('Tax Rate Schedules');
      expect(worksheetWalk).toMatch(/Schedule [XYZ]/);
      expect(computeStateTax({ law: CALIFORNIA_STATE_TAX, filingStatus, taxableIncome })).toBe(expectedTax);
    },
  );

  it('floors negative taxable income at zero', () => {
    expect(computeStateTax({ law: CALIFORNIA_STATE_TAX, filingStatus: 'single', taxableIncome: -1 })).toBe(0);
    expect(computeStateTax({ law: PENNSYLVANIA_STATE_TAX, filingStatus: 'single', taxableIncome: -1 })).toBe(0);
  });
});
