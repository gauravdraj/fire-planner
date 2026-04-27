import { describe, expect, it } from 'vitest';

import {
  computeIrmaa,
  lookupIrmaaMagi,
  lookupIrmaaTier,
  type IrmaaInput,
  type IrmaaResult,
} from '@/core/tax/irmaa';
import type { FilingStatus, MagiYear } from '@/core/types';

const CMS_IRMAA_2026 =
  'CMS 2026 Medicare Parts A & B Premiums and Deductibles fact sheet, retrieved 2026-04-26, https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles';
const SSA_POMS_IRMAA_TABLES =
  'SSA POMS HI 01101.020, 2026 IRMAA sliding scale tables, retrieved 2026-04-26, https://secure.ssa.gov/poms.nsf/lnx/0601101020';
const SSA_POMS_IRMAA_CALC =
  'SSA POMS HI 01101.031, total Medicare Part B premium composition and statutory citations, retrieved 2026-04-26, https://secure.ssa.gov/poms.nsf/lnx/0601101031';
const SOCIAL_SECURITY_ACT_IRMAA =
  'Social Security Act sections 1839(i) and 1860D-13(a)(7), Part B and Part D IRMAA authority';

type ExpectedIrmaaAmounts = Omit<IrmaaResult, 'magiUsed' | 'magiSourceYear'>;

type IrmaaTierFixture = Readonly<{
  name: string;
  filingStatus: FilingStatus;
  magi: number;
  citation: string;
  worksheetWalk: string;
  expected: ExpectedIrmaaAmounts;
}>;

function expectSourceBackedFixture(fixture: IrmaaTierFixture): void {
  const input = {
    premiumYear: 2026,
    filingStatus: fixture.filingStatus,
    magiHistory: [{ year: 2024, magi: fixture.magi }],
  } satisfies IrmaaInput;

  expect(fixture.citation).toContain('CMS 2026');
  expect(fixture.citation).toContain('HI 01101.020');
  expect(fixture.worksheetWalk).toContain('$202.90');

  expect(computeIrmaa(input)).toEqual({
    ...fixture.expected,
    magiUsed: fixture.magi,
    magiSourceYear: 2024,
  });
}

// Expected dollar amounts below are hand-typed fixture values from CMS/SSA
// sources, not derived from CONSTANTS_2026.
const SINGLE_FILER_FIXTURES = [
  {
    name: 'single tier 0 uses the standard Part B premium with no Part B or Part D IRMAA',
    filingStatus: 'single',
    magi: 109_000,
    citation: `${CMS_IRMAA_2026}; ${SSA_POMS_IRMAA_TABLES}; ${SSA_POMS_IRMAA_CALC}`,
    worksheetWalk:
      'Single MAGI not more than $109,000: standard Part B premium is $202.90, Part B IRMAA is $0.00, and Part D IRMAA is $0.00. Annual IRMAA surcharge is $0.00. Annual total is $202.90 * 12 = $2,434.80.',
    expected: {
      standardPartBPremium: 202.9,
      partBMonthlyAdjustment: 0,
      partDMonthlyAdjustment: 0,
      annualIrmaaSurcharge: 0,
      annualTotal: 2_434.8,
      tier: 0,
    },
  },
  {
    name: 'single tier 1 includes the first Part B and Part D monthly adjustment amounts',
    filingStatus: 'single',
    magi: 109_001,
    citation: `${CMS_IRMAA_2026}; ${SSA_POMS_IRMAA_TABLES}; ${SSA_POMS_IRMAA_CALC}`,
    worksheetWalk:
      'Single MAGI above $109,000 and not more than $137,000: standard Part B premium is $202.90, Part B IRMAA is $81.20, and Part D IRMAA is $14.50. Annual IRMAA surcharge is ($81.20 + $14.50) * 12 = $1,148.40. Annual total is ($202.90 + $81.20 + $14.50) * 12 = $3,583.20.',
    expected: {
      standardPartBPremium: 202.9,
      partBMonthlyAdjustment: 81.2,
      partDMonthlyAdjustment: 14.5,
      annualIrmaaSurcharge: 1_148.4,
      annualTotal: 3_583.2,
      tier: 1,
    },
  },
  {
    name: 'single tier 3 includes mid-tier Part B and Part D monthly adjustment amounts',
    filingStatus: 'single',
    magi: 172_000,
    citation: `${CMS_IRMAA_2026}; ${SSA_POMS_IRMAA_TABLES}; ${SSA_POMS_IRMAA_CALC}`,
    worksheetWalk:
      'Single MAGI above $171,000 and not more than $205,000: standard Part B premium is $202.90, Part B IRMAA is $324.60, and Part D IRMAA is $60.40. Annual IRMAA surcharge is ($324.60 + $60.40) * 12 = $4,620.00. Annual total is ($202.90 + $324.60 + $60.40) * 12 = $7,054.80.',
    expected: {
      standardPartBPremium: 202.9,
      partBMonthlyAdjustment: 324.6,
      partDMonthlyAdjustment: 60.4,
      annualIrmaaSurcharge: 4_620,
      annualTotal: 7_054.8,
      tier: 3,
    },
  },
  {
    name: 'single maximum tier includes the highest Part B and Part D monthly adjustment amounts',
    filingStatus: 'single',
    magi: 500_000,
    citation: `${CMS_IRMAA_2026}; ${SSA_POMS_IRMAA_TABLES}; ${SSA_POMS_IRMAA_CALC}`,
    worksheetWalk:
      'Single MAGI at least $500,000: standard Part B premium is $202.90, Part B IRMAA is $487.00, and Part D IRMAA is $91.00. Annual IRMAA surcharge is ($487.00 + $91.00) * 12 = $6,936.00. Annual total is ($202.90 + $487.00 + $91.00) * 12 = $9,370.80.',
    expected: {
      standardPartBPremium: 202.9,
      partBMonthlyAdjustment: 487,
      partDMonthlyAdjustment: 91,
      annualIrmaaSurcharge: 6_936,
      annualTotal: 9_370.8,
      tier: 5,
    },
  },
] satisfies readonly IrmaaTierFixture[];

const MFJ_FIXTURES = [
  {
    name: 'MFJ tier 0 uses the standard Part B premium with no Part B or Part D IRMAA',
    filingStatus: 'mfj',
    magi: 218_000,
    citation: `${CMS_IRMAA_2026}; ${SSA_POMS_IRMAA_TABLES}; ${SSA_POMS_IRMAA_CALC}`,
    worksheetWalk:
      'Married filing jointly MAGI not more than $218,000: standard Part B premium is $202.90, Part B IRMAA is $0.00, and Part D IRMAA is $0.00. Annual IRMAA surcharge is $0.00. Annual total is $202.90 * 12 = $2,434.80.',
    expected: {
      standardPartBPremium: 202.9,
      partBMonthlyAdjustment: 0,
      partDMonthlyAdjustment: 0,
      annualIrmaaSurcharge: 0,
      annualTotal: 2_434.8,
      tier: 0,
    },
  },
  {
    name: 'MFJ tier 1 includes the first Part B and Part D monthly adjustment amounts',
    filingStatus: 'mfj',
    magi: 218_001,
    citation: `${CMS_IRMAA_2026}; ${SSA_POMS_IRMAA_TABLES}; ${SSA_POMS_IRMAA_CALC}`,
    worksheetWalk:
      'Married filing jointly MAGI above $218,000 and not more than $274,000: standard Part B premium is $202.90, Part B IRMAA is $81.20, and Part D IRMAA is $14.50. Annual IRMAA surcharge is ($81.20 + $14.50) * 12 = $1,148.40. Annual total is ($202.90 + $81.20 + $14.50) * 12 = $3,583.20.',
    expected: {
      standardPartBPremium: 202.9,
      partBMonthlyAdjustment: 81.2,
      partDMonthlyAdjustment: 14.5,
      annualIrmaaSurcharge: 1_148.4,
      annualTotal: 3_583.2,
      tier: 1,
    },
  },
  {
    name: 'MFJ tier 3 includes mid-tier Part B and Part D monthly adjustment amounts',
    filingStatus: 'mfj',
    magi: 343_000,
    citation: `${CMS_IRMAA_2026}; ${SSA_POMS_IRMAA_TABLES}; ${SSA_POMS_IRMAA_CALC}`,
    worksheetWalk:
      'Married filing jointly MAGI above $342,000 and not more than $410,000: standard Part B premium is $202.90, Part B IRMAA is $324.60, and Part D IRMAA is $60.40. Annual IRMAA surcharge is ($324.60 + $60.40) * 12 = $4,620.00. Annual total is ($202.90 + $324.60 + $60.40) * 12 = $7,054.80.',
    expected: {
      standardPartBPremium: 202.9,
      partBMonthlyAdjustment: 324.6,
      partDMonthlyAdjustment: 60.4,
      annualIrmaaSurcharge: 4_620,
      annualTotal: 7_054.8,
      tier: 3,
    },
  },
  {
    name: 'MFJ maximum tier includes the highest Part B and Part D monthly adjustment amounts',
    filingStatus: 'mfj',
    magi: 750_000,
    citation: `${CMS_IRMAA_2026}; ${SSA_POMS_IRMAA_TABLES}; ${SSA_POMS_IRMAA_CALC}`,
    worksheetWalk:
      'Married filing jointly MAGI at least $750,000: standard Part B premium is $202.90, Part B IRMAA is $487.00, and Part D IRMAA is $91.00. Annual IRMAA surcharge is ($487.00 + $91.00) * 12 = $6,936.00. Annual total is ($202.90 + $487.00 + $91.00) * 12 = $9,370.80.',
    expected: {
      standardPartBPremium: 202.9,
      partBMonthlyAdjustment: 487,
      partDMonthlyAdjustment: 91,
      annualIrmaaSurcharge: 6_936,
      annualTotal: 9_370.8,
      tier: 5,
    },
  },
] satisfies readonly IrmaaTierFixture[];

describe('Medicare IRMAA fixtures', () => {
  it.each(SINGLE_FILER_FIXTURES)('$name', (fixture) => {
    expectSourceBackedFixture(fixture);
  });

  it.each(MFJ_FIXTURES)('$name', (fixture) => {
    expectSourceBackedFixture(fixture);
  });

  it('uses 2024 MAGI for 2026 IRMAA even when current-year MAGI would be tier 0', () => {
    const citation = `${SSA_POMS_IRMAA_TABLES}; ${SOCIAL_SECURITY_ACT_IRMAA}`;
    const history = [
      { year: 2024, magi: 500_000 },
      { year: 2026, magi: 50_000 },
    ] satisfies readonly MagiYear[];

    expect(citation).toContain('1839(i)');

    expect(lookupIrmaaMagi(2026, history)).toEqual({
      magiUsed: 500_000,
      magiSourceYear: 2024,
    });
    expect(
      computeIrmaa({
        premiumYear: 2026,
        filingStatus: 'single',
        magiHistory: history,
      }),
    ).toMatchObject({
      tier: 5,
      partBMonthlyAdjustment: 487,
      partDMonthlyAdjustment: 91,
      annualIrmaaSurcharge: 6_936,
      magiUsed: 500_000,
      magiSourceYear: 2024,
    });
  });

  it('falls back to 2023 MAGI when 2024 MAGI is missing', () => {
    const citation = `${SSA_POMS_IRMAA_TABLES}; ${SSA_POMS_IRMAA_CALC}`;
    const history = [{ year: 2023, magi: 172_000 }] satisfies readonly MagiYear[];

    expect(citation).toMatch(/2026 IRMAA|total Medicare/);

    expect(lookupIrmaaMagi(2026, history)).toEqual({
      magiUsed: 172_000,
      magiSourceYear: 2023,
    });
    expect(
      computeIrmaa({
        premiumYear: 2026,
        filingStatus: 'single',
        magiHistory: history,
      }),
    ).toMatchObject({
      tier: 3,
      partBMonthlyAdjustment: 324.6,
      partDMonthlyAdjustment: 60.4,
      annualIrmaaSurcharge: 4_620,
      magiUsed: 172_000,
      magiSourceYear: 2023,
    });
  });

  it('returns undefined MAGI metadata and no surcharge when neither lookback year is present', () => {
    const history = [
      { year: 2022, magi: 500_000 },
      { year: 2025, magi: 500_000 },
    ] satisfies readonly MagiYear[];

    expect(lookupIrmaaMagi(2026, history)).toBeUndefined();
    expect(
      computeIrmaa({
        premiumYear: 2026,
        filingStatus: 'mfj',
        magiHistory: history,
      }),
    ).toEqual({
      standardPartBPremium: 202.9,
      partBMonthlyAdjustment: 0,
      partDMonthlyAdjustment: 0,
      annualIrmaaSurcharge: 0,
      annualTotal: 2_434.8,
      tier: 0,
      magiUsed: undefined,
      magiSourceYear: undefined,
    });
  });

  it('handles single-filer threshold edges with first cutoff inclusive in tier 0', () => {
    const citation = `${SSA_POMS_IRMAA_TABLES}; ${CMS_IRMAA_2026}`;
    expect(citation).toContain('sliding scale');

    expect(lookupIrmaaTier('single', 109_000)).toEqual({
      tier: 0,
      partBMonthlyAdjustment: 0,
      partDMonthlyAdjustment: 0,
    });
    expect(lookupIrmaaTier('single', 109_001)).toEqual({
      tier: 1,
      partBMonthlyAdjustment: 81.2,
      partDMonthlyAdjustment: 14.5,
    });
    expect(lookupIrmaaTier('single', 137_000)).toEqual({
      tier: 1,
      partBMonthlyAdjustment: 81.2,
      partDMonthlyAdjustment: 14.5,
    });
    expect(lookupIrmaaTier('single', 137_001)).toEqual({
      tier: 2,
      partBMonthlyAdjustment: 202.9,
      partDMonthlyAdjustment: 37.5,
    });
    expect(lookupIrmaaTier('single', 500_000)).toEqual({
      tier: 5,
      partBMonthlyAdjustment: 487,
      partDMonthlyAdjustment: 91,
    });
  });

  it('handles married-filing-separately less-than and at-least cutoffs without assuming single-filer tiers', () => {
    const citation = `${SSA_POMS_IRMAA_TABLES}; ${SOCIAL_SECURITY_ACT_IRMAA}`;
    expect(citation).toContain('1860D-13');

    expect(lookupIrmaaTier('mfs', 109_000)).toEqual({
      tier: 0,
      partBMonthlyAdjustment: 0,
      partDMonthlyAdjustment: 0,
    });
    expect(lookupIrmaaTier('mfs', 390_999)).toEqual({
      tier: 1,
      partBMonthlyAdjustment: 446.3,
      partDMonthlyAdjustment: 83.3,
    });
    expect(lookupIrmaaTier('mfs', 391_000)).toEqual({
      tier: 2,
      partBMonthlyAdjustment: 487,
      partDMonthlyAdjustment: 91,
    });
  });
});
