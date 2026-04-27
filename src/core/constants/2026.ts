import type { BracketTable, FilingStatus, LtcgBracketTable } from '../types';

const RETRIEVED_AT = '2026-04-26';

const IRS_REV_PROC_2025_32 =
  'IRS Rev. Proc. 2025-32, 2026 inflation-adjusted tax items, https://www.irs.gov/pub/irs-drop/rp-25-32.pdf';
const IRS_NIIT =
  'IRS Net Investment Income Tax guidance, https://www.irs.gov/individuals/net-investment-income-tax';
const SSA_2026_COLA =
  'Social Security Administration 2026 COLA Fact Sheet, https://www.ssa.gov/cola/factsheets/2026.html';
const HHS_FPL_2026 =
  'HHS 2026 Poverty Guidelines, 91 FR 1797, https://www.govinfo.gov/content/pkg/FR-2026-01-15/html/2026-00755.htm';
const HHS_FPL_2025 =
  'HHS 2025 Poverty Guidelines, 90 FR 5917, https://www.federalregister.gov/documents/2025/01/17/2025-01377/annual-update-of-the-hhs-poverty-guidelines';
const IRS_REV_PROC_2025_25 =
  'IRS Rev. Proc. 2025-25, 2026 ACA applicable percentage table, https://www.irs.gov/pub/irs-drop/rp-25-25.pdf';
const CMS_IRMAA_2026 =
  'CMS 2026 Medicare Parts A & B Premiums and Deductibles fact sheet, https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles';

type Freezable = Record<PropertyKey, unknown>;

function isFreezable(value: unknown): value is Freezable {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function deepFreeze<T>(value: T): T {
  if (!isFreezable(value) || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value) as T;
}

export const CONSTANTS_2026 = deepFreeze({
  taxYear: 2026,
  retrievedAt: RETRIEVED_AT,
  federal: {
    source: IRS_REV_PROC_2025_32,
    retrievedAt: RETRIEVED_AT,
    standardDeduction: {
      single: 16_100,
      mfj: 32_200,
      hoh: 24_150,
      mfs: 16_100,
    } satisfies Record<FilingStatus, number>,
    ordinaryBrackets: {
      single: [
        { from: 0, rate: 0.1 },
        { from: 12_400, rate: 0.12 },
        { from: 50_400, rate: 0.22 },
        { from: 105_700, rate: 0.24 },
        { from: 201_775, rate: 0.32 },
        { from: 256_225, rate: 0.35 },
        { from: 640_600, rate: 0.37 },
      ],
      mfj: [
        { from: 0, rate: 0.1 },
        { from: 24_800, rate: 0.12 },
        { from: 100_800, rate: 0.22 },
        { from: 211_400, rate: 0.24 },
        { from: 403_550, rate: 0.32 },
        { from: 512_450, rate: 0.35 },
        { from: 768_700, rate: 0.37 },
      ],
      hoh: [
        { from: 0, rate: 0.1 },
        { from: 17_700, rate: 0.12 },
        { from: 67_450, rate: 0.22 },
        { from: 105_700, rate: 0.24 },
        { from: 201_750, rate: 0.32 },
        { from: 256_200, rate: 0.35 },
        { from: 640_600, rate: 0.37 },
      ],
      mfs: [
        { from: 0, rate: 0.1 },
        { from: 12_400, rate: 0.12 },
        { from: 50_400, rate: 0.22 },
        { from: 105_700, rate: 0.24 },
        { from: 201_775, rate: 0.32 },
        { from: 256_225, rate: 0.35 },
        { from: 384_350, rate: 0.37 },
      ],
    } satisfies BracketTable,
  },
  ltcg: {
    source: IRS_REV_PROC_2025_32,
    retrievedAt: RETRIEVED_AT,
    brackets: {
      single: [
        { from: 0, rate: 0 },
        { from: 49_450, rate: 0.15 },
        { from: 545_500, rate: 0.2 },
      ],
      mfj: [
        { from: 0, rate: 0 },
        { from: 98_900, rate: 0.15 },
        { from: 613_700, rate: 0.2 },
      ],
      hoh: [
        { from: 0, rate: 0 },
        { from: 66_200, rate: 0.15 },
        { from: 579_600, rate: 0.2 },
      ],
      mfs: [
        { from: 0, rate: 0 },
        { from: 49_450, rate: 0.15 },
        { from: 306_850, rate: 0.2 },
      ],
    } satisfies LtcgBracketTable,
  },
  niit: {
    source: IRS_NIIT,
    retrievedAt: RETRIEVED_AT,
    rate: 0.038,
    magiThresholds: {
      single: 200_000,
      mfj: 250_000,
      hoh: 200_000,
      mfs: 125_000,
    } satisfies Record<FilingStatus, number>,
  },
  seTax: {
    source: SSA_2026_COLA,
    retrievedAt: RETRIEVED_AT,
    ssWageBase: 184_500,
    selfEmploymentRate: 0.153,
    oasdiRate: 0.124,
    medicareRate: 0.029,
    additionalMedicareRate: 0.009,
    additionalMedicareThresholds: {
      single: 200_000,
      mfj: 250_000,
      hoh: 200_000,
      mfs: 125_000,
    } satisfies Record<FilingStatus, number>,
  },
  qbi: {
    source: IRS_REV_PROC_2025_32,
    retrievedAt: RETRIEVED_AT,
    phaseouts: {
      single: { start: 201_750, end: 276_750 },
      mfj: { start: 403_500, end: 553_500 },
      hoh: { start: 201_750, end: 276_750 },
      mfs: { start: 201_775, end: 276_775 },
    } satisfies Record<FilingStatus, { start: number; end: number }>,
  },
  fpl: {
    year: 2026,
    source: HHS_FPL_2026,
    retrievedAt: RETRIEVED_AT,
    contiguous: {
      householdSize: {
        1: 15_960,
        2: 21_640,
        3: 27_320,
        4: 33_000,
        5: 38_680,
        6: 44_360,
        7: 50_040,
        8: 55_720,
      },
      additionalPerPerson: 5_680,
    },
    alaska: {
      householdSize: {
        1: 19_950,
        2: 27_050,
        3: 34_150,
        4: 41_250,
        5: 48_350,
        6: 55_450,
        7: 62_550,
        8: 69_650,
      },
      additionalPerPerson: 7_100,
    },
    hawaii: {
      householdSize: {
        1: 18_360,
        2: 24_890,
        3: 31_420,
        4: 37_950,
        5: 44_480,
        6: 51_010,
        7: 57_540,
        8: 64_070,
      },
      additionalPerPerson: 6_530,
    },
  },
  fpl2025: {
    year: 2025,
    source: HHS_FPL_2025,
    retrievedAt: RETRIEVED_AT,
    contiguous: {
      householdSize: {
        1: 15_650,
        2: 21_150,
        3: 26_650,
        4: 32_150,
        5: 37_650,
        6: 43_150,
        7: 48_650,
        8: 54_150,
      },
      additionalPerPerson: 5_500,
    },
    alaska: {
      householdSize: {
        1: 19_550,
        2: 26_430,
        3: 33_310,
        4: 40_190,
        5: 47_070,
        6: 53_950,
        7: 60_830,
        8: 67_710,
      },
      additionalPerPerson: 6_880,
    },
    hawaii: {
      householdSize: {
        1: 17_990,
        2: 24_320,
        3: 30_650,
        4: 36_980,
        5: 43_310,
        6: 49_640,
        7: 55_970,
        8: 62_300,
      },
      additionalPerPerson: 6_330,
    },
  },
  aca: {
    source: IRS_REV_PROC_2025_25,
    retrievedAt: RETRIEVED_AT,
    premiumTaxCreditFplYear: 2025,
    requiredContributionPercentage: 0.0996,
    applicablePercentages: [
      { fplFrom: 0, fplTo: 1.33, initial: 0.021, final: 0.021 },
      { fplFrom: 1.33, fplTo: 1.5, initial: 0.0314, final: 0.0419 },
      { fplFrom: 1.5, fplTo: 2, initial: 0.0419, final: 0.066 },
      { fplFrom: 2, fplTo: 2.5, initial: 0.066, final: 0.0844 },
      { fplFrom: 2.5, fplTo: 3, initial: 0.0844, final: 0.0996 },
      { fplFrom: 3, fplTo: 4, initial: 0.0996, final: 0.0996 },
    ],
  },
  irmaa: {
    source: CMS_IRMAA_2026,
    retrievedAt: RETRIEVED_AT,
    incomeYear: 2024,
    lookbackYears: 2,
    standardPartBPremium: 202.9,
    partBTiers: {
      single: [
        { magiOver: null, magiUpToInclusive: 109_000, partBMonthlyAdjustment: 0, partDMonthlyAdjustment: 0 },
        { magiOver: 109_000, magiUpToInclusive: 137_000, partBMonthlyAdjustment: 81.2, partDMonthlyAdjustment: 14.5 },
        { magiOver: 137_000, magiUpToInclusive: 171_000, partBMonthlyAdjustment: 202.9, partDMonthlyAdjustment: 37.5 },
        { magiOver: 171_000, magiUpToInclusive: 205_000, partBMonthlyAdjustment: 324.6, partDMonthlyAdjustment: 60.4 },
        { magiOver: 205_000, magiLessThan: 500_000, partBMonthlyAdjustment: 446.3, partDMonthlyAdjustment: 83.3 },
        { magiAtLeast: 500_000, partBMonthlyAdjustment: 487, partDMonthlyAdjustment: 91 },
      ],
      mfj: [
        { magiOver: null, magiUpToInclusive: 218_000, partBMonthlyAdjustment: 0, partDMonthlyAdjustment: 0 },
        { magiOver: 218_000, magiUpToInclusive: 274_000, partBMonthlyAdjustment: 81.2, partDMonthlyAdjustment: 14.5 },
        { magiOver: 274_000, magiUpToInclusive: 342_000, partBMonthlyAdjustment: 202.9, partDMonthlyAdjustment: 37.5 },
        { magiOver: 342_000, magiUpToInclusive: 410_000, partBMonthlyAdjustment: 324.6, partDMonthlyAdjustment: 60.4 },
        { magiOver: 410_000, magiLessThan: 750_000, partBMonthlyAdjustment: 446.3, partDMonthlyAdjustment: 83.3 },
        { magiAtLeast: 750_000, partBMonthlyAdjustment: 487, partDMonthlyAdjustment: 91 },
      ],
      hoh: [
        { magiOver: null, magiUpToInclusive: 109_000, partBMonthlyAdjustment: 0, partDMonthlyAdjustment: 0 },
        { magiOver: 109_000, magiUpToInclusive: 137_000, partBMonthlyAdjustment: 81.2, partDMonthlyAdjustment: 14.5 },
        { magiOver: 137_000, magiUpToInclusive: 171_000, partBMonthlyAdjustment: 202.9, partDMonthlyAdjustment: 37.5 },
        { magiOver: 171_000, magiUpToInclusive: 205_000, partBMonthlyAdjustment: 324.6, partDMonthlyAdjustment: 60.4 },
        { magiOver: 205_000, magiLessThan: 500_000, partBMonthlyAdjustment: 446.3, partDMonthlyAdjustment: 83.3 },
        { magiAtLeast: 500_000, partBMonthlyAdjustment: 487, partDMonthlyAdjustment: 91 },
      ],
      mfs: [
        { magiOver: null, magiUpToInclusive: 109_000, partBMonthlyAdjustment: 0, partDMonthlyAdjustment: 0 },
        { magiOver: 109_000, magiLessThan: 391_000, partBMonthlyAdjustment: 446.3, partDMonthlyAdjustment: 83.3 },
        { magiAtLeast: 391_000, partBMonthlyAdjustment: 487, partDMonthlyAdjustment: 91 },
      ],
    },
  },
} as const);
