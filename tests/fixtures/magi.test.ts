import { describe, expect, it } from 'vitest';

import { computeAgi, computeMagiAca, computeMagiIrmaa } from '@/core/tax/magi';

const IRS_FORM_1040_2025 =
  'IRS Form 1040 (2025), lines 1a, 4b, 5b, 6b, 7, 8, 10, and 11 AGI, https://www.irs.gov/pub/irs-pdf/f1040.pdf';
const IRS_SCHEDULE_1_2025 =
  'IRS Schedule 1 (Form 1040) 2025, additional income and adjustments to income, https://www.irs.gov/pub/irs-pdf/f1040s1.pdf';
const IRC_36B =
  '26 U.S.C. § 36B(d)(2)(B), ACA premium tax credit modified AGI add-backs, https://uscode.house.gov/view.xhtml?req=(title:26%20section:36B%20edition:prelim)';
const IRS_FORM_8962_2025 =
  'IRS Instructions for Form 8962 (2025), Modified AGI includes tax-exempt interest, excluded foreign income, and nontaxable Social Security, https://www.irs.gov/instructions/i8962';
const MEDICARE_IRMAA =
  '42 U.S.C. § 1395r(i)(4), Medicare Part B IRMAA MAGI is AGI plus tax-exempt interest, https://uscode.house.gov/view.xhtml?req=(title:42%20section:1395r%20edition:prelim)';

type AgiFixture = {
  label: string;
  input: Parameters<typeof computeAgi>[0];
  expectedAgi: number;
  worksheetWalk: string;
  citations: readonly string[];
};

type AcaMagiFixture = {
  label: string;
  input: Parameters<typeof computeMagiAca>[0];
  expectedMagi: number;
  worksheetWalk: string;
  citations: readonly string[];
};

type IrmaaMagiFixture = {
  label: string;
  input: Parameters<typeof computeMagiIrmaa>[0];
  expectedMagi: number;
  worksheetWalk: string;
  citations: readonly string[];
};

/*
 * Expected values are hand-entered Form 1040 / Schedule 1 / MAGI definition
 * walks. They intentionally do not import production constants.
 */
const agiFixtures: readonly AgiFixture[] = [
  {
    label: 'aggregates taxable income streams and subtracts SE half plus named adjustments',
    input: {
      wages: 82_000,
      netSelfEmploymentIncome: 18_500,
      pensions: 12_000,
      taxableSocialSecurity: 7_650,
      iraDistributions: 4_000,
      rothConversions: 10_000,
      taxableBrokerageIncome: 3_250.55,
      capitalGains: 6_100.45,
      rentalNetIncome: -2_400,
      otherIncome: 1_200,
      seDeductibleHalf: 1_306.2,
      aboveTheLineDeductions: {
        traditionalIra: 2_000,
        hsa: 1_500,
        studentLoanInterest: 900,
        selfEmployedHealthInsurance: 2_400,
      },
    },
    expectedAgi: 134_194.8,
    worksheetWalk:
      'Form 1040/Schedule 1 walk: income totals 142,301.00. Adjustments are deductible half SE tax 1,306.20 plus IRA 2,000, HSA 1,500, student loan interest 900, and SE health insurance 2,400, for total adjustments of 8,106.20. AGI is 134,194.80.',
    citations: [IRS_FORM_1040_2025, IRS_SCHEDULE_1_2025],
  },
  {
    label: 'allows net income components such as capital loss, rental net income, and other income',
    input: {
      netSelfEmploymentIncome: 72_345.67,
      iraDistributions: 25_000,
      rothConversions: 15_000,
      taxableBrokerageIncome: 1_234.56,
      capitalGains: -3_000,
      rentalNetIncome: 8_800.1,
      otherIncome: -500,
      seDeductibleHalf: 5_123.45,
      aboveTheLineDeductions: {
        hsa: 4_150,
        otherSupported: 1_200,
      },
    },
    expectedAgi: 108_406.88,
    worksheetWalk:
      'Form 1040/Schedule 1 walk: income totals 118,880.33 after the net capital loss, rental income, and other income entries. Adjustments are deductible half SE tax 5,123.45, HSA 4,150, and other supported adjustments 1,200. AGI is 108,406.88.',
    citations: [IRS_FORM_1040_2025, IRS_SCHEDULE_1_2025],
  },
];

const acaMagiFixtures: readonly AcaMagiFixture[] = [
  {
    label: 'adds tax-exempt interest and nontaxable Social Security benefits to AGI',
    input: {
      agi: 60_000,
      taxExemptInterest: 1_250,
      nonTaxableSocialSecurityBenefits: 12_000,
      foreignEarnedIncomeExclusion: 0,
    },
    expectedMagi: 73_250,
    worksheetWalk:
      'ACA MAGI walk: 60,000 AGI + 1,250 tax-exempt interest + 12,000 Social Security benefits excluded from gross income + 0 foreign earned income exclusion = 73,250.',
    citations: [IRC_36B, IRS_FORM_8962_2025],
  },
  {
    label: 'adds excluded foreign earned income for ACA MAGI',
    input: {
      agi: 98_765.43,
      taxExemptInterest: 234.56,
      nonTaxableSocialSecurityBenefits: 0,
      foreignEarnedIncomeExclusion: 17_500.25,
    },
    expectedMagi: 116_500.24,
    worksheetWalk:
      'ACA MAGI walk: 98,765.43 AGI + 234.56 tax-exempt interest + 0 nontaxable Social Security + 17,500.25 foreign earned income exclusion = 116,500.24.',
    citations: [IRC_36B, IRS_FORM_8962_2025],
  },
];

const irmaaMagiFixtures: readonly IrmaaMagiFixture[] = [
  {
    label: 'adds tax-exempt interest only, excluding nontaxable Social Security add-back',
    input: {
      agi: 60_000,
      taxExemptInterest: 1_250,
    },
    expectedMagi: 61_250,
    worksheetWalk:
      'IRMAA MAGI walk: 60,000 AGI + 1,250 tax-exempt interest = 61,250. Nontaxable Social Security is not an IRMAA add-back.',
    citations: [MEDICARE_IRMAA],
  },
  {
    label: 'does not add excluded foreign earned income for IRMAA MAGI',
    input: {
      agi: 98_765.43,
      taxExemptInterest: 234.56,
    },
    expectedMagi: 98_999.99,
    worksheetWalk:
      'IRMAA MAGI walk: 98,765.43 AGI + 234.56 tax-exempt interest = 98,999.99. Foreign earned income exclusion is not part of this IRMAA definition.',
    citations: [MEDICARE_IRMAA],
  },
];

describe('AGI and MAGI fixtures', () => {
  it.each(agiFixtures)('$label', ({ citations, expectedAgi, input, worksheetWalk }) => {
    expect(citations.join('; ')).toMatch(/Form 1040|Schedule 1/);
    expect(worksheetWalk).toMatch(/AGI/);

    expect(computeAgi(input)).toBe(expectedAgi);
  });

  it.each(acaMagiFixtures)('$label', ({ citations, expectedMagi, input, worksheetWalk }) => {
    expect(citations.join('; ')).toMatch(/36B|Form 8962/);
    expect(worksheetWalk).toMatch(/ACA MAGI/);

    expect(computeMagiAca(input)).toBe(expectedMagi);
  });

  it.each(irmaaMagiFixtures)('$label', ({ citations, expectedMagi, input, worksheetWalk }) => {
    expect(citations.join('; ')).toMatch(/1395r|IRMAA/);
    expect(worksheetWalk).toMatch(/IRMAA MAGI/);

    expect(computeMagiIrmaa(input)).toBe(expectedMagi);
  });

  it('keeps the nontaxable Social Security ACA add-back out of IRMAA MAGI', () => {
    const baseInput = {
      agi: 60_000,
      taxExemptInterest: 1_250,
    };

    expect(
      computeMagiAca({
        ...baseInput,
        nonTaxableSocialSecurityBenefits: 12_000,
        foreignEarnedIncomeExclusion: 0,
      }),
    ).toBe(73_250);
    expect(computeMagiIrmaa(baseInput)).toBe(61_250);
  });
});
