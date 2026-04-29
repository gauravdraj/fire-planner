import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import { runProjection } from '@/core/projection';
import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { buildYearByYearCsv } from '@/lib/csvExport';
import { getYearByYearColumnLabel, yearByYearColumns, type VisibleYearByYearColumnId } from '@/lib/yearByYearColumns';

const BASIC_FORM_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'mfj',
  stateCode: 'FL',
  primaryAge: 60,
  partnerAge: 60,
  retirementYear: 2028,
  planEndAge: 90,
  annualSpendingToday: 110_000,
  inflationRate: 0.025,
  annualMortgagePAndI: 0,
  mortgagePayoffYear: 0,
  annualW2Income: 180_000,
  annualConsultingIncome: 0,
  annualRentalIncome: 0,
  annualSocialSecurityBenefit: 42_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 0,
  brokerageAndCashBalance: 600_000,
  taxableBrokerageBasis: 400_000,
  hsaBalance: 25_000,
  traditionalBalance: 900_000,
  rothBalance: 200_000,
  autoDepleteBrokerageEnabled: false,
  autoDepleteBrokerageYears: 10,
  autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
  expectedReturnTraditional: 0.05,
  expectedReturnRoth: 0.05,
  expectedReturnBrokerage: 0.05,
  expectedReturnHsa: 0.05,
  brokerageDividendYield: 0,
  brokerageQdiPercentage: 0.95,
  healthcarePhase: 'aca',
};

const MONEY_COLUMN_IDS = [
  'traditionalBalance',
  'rothBalance',
  'hsaBalance',
  'taxableBrokerageBalance',
  'cashBalance',
  'endingBalance',
  'brokerageBasisRemaining',
  'spending',
  'wages',
  'taxableSocialSecurity',
  'traditionalWithdrawals',
  'rothConversions',
  'brokerageWithdrawals',
  'realizedLtcg',
  'agi',
  'federalTax',
  'stateTax',
  'ltcgTax',
  'niit',
  'seTax',
  'totalTax',
  'acaMagi',
  'acaPremiumCredit',
  'irmaaPremium',
  'afterTaxCashFlow',
] as const satisfies readonly VisibleYearByYearColumnId[];

function buildCsv() {
  const { scenario, plan } = mapBasicFormToProjectionInputs(BASIC_FORM_VALUES);
  const rows = runProjection(scenario, plan);
  const csv = buildYearByYearCsv(rows, scenario, BASIC_FORM_VALUES, 'nominal');

  return { csv, rows, scenario };
}

function splitCsv(csv: string): string[] {
  return csv.split('\n');
}

function splitSimpleCsvLine(line: string): string[] {
  return line.split(',');
}

function columnIndexById(id: VisibleYearByYearColumnId): number {
  return yearByYearColumns.findIndex((column) => column.id === id);
}

describe('buildYearByYearCsv', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits the required five-line preamble with deterministic scenario summary fields', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T18:35:00.000Z'));

    const { csv, rows, scenario } = buildCsv();
    const lines = splitCsv(csv);

    expect(lines[0]).toBe('Generated at,2026-04-27T18:35:00.000Z');
    expect(lines[1]).toBe(`Constants retrieved at,${CONSTANTS_2026.retrievedAt}`);
    expect(lines[2]).toBe('Display unit,nominal');
    expect(lines[3]).toBe(
      [
        'Scenario summary',
        `startYear=${scenario.startYear}`,
        `retirementYear=${BASIC_FORM_VALUES.retirementYear}`,
        `filingStatus=${scenario.filingStatus}`,
        `planEndYear=${rows.at(-1)?.year}`,
        'startingAccountBalanceTotal=1725000.00',
      ].join('; '),
    );
    expect(lines[3]).not.toContain('...');
    expect(lines[4]).toBe('');
    expect(lines[5]).toBe(yearByYearColumns.map((column) => getYearByYearColumnLabel(column)).join(','));
  });

  it('uses the shared year-by-year column metadata for header names and data-section shape', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T18:35:00.000Z'));

    const { csv, rows } = buildCsv();
    const lines = splitCsv(csv);
    const dataSection = lines.slice(5);
    const header = splitSimpleCsvLine(dataSection[0] ?? '');

    expect(dataSection).toHaveLength(rows.length + 1);
    expect(header).toEqual(yearByYearColumns.map((column) => getYearByYearColumnLabel(column)));

    for (const line of dataSection.slice(1)) {
      expect(splitSimpleCsvLine(line)).toHaveLength(header.length);
    }
  });

  it('formats money columns with cents precision and no thousands separators', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T18:35:00.000Z'));

    const { csv } = buildCsv();
    const dataRows = splitCsv(csv).slice(6).map(splitSimpleCsvLine);

    for (const row of dataRows) {
      for (const columnId of MONEY_COLUMN_IDS) {
        const value = row[columnIndexById(columnId)] ?? '';

        expect(value).not.toContain('$');
        expect(value).not.toContain(',');
        expect(value === '' || /^-?\d+\.\d{2}$/.test(value)).toBe(true);
      }
    }

    const firstRow = dataRows[0] ?? [];
    expect(firstRow[columnIndexById('taxableBrokerageBalance')]).toMatch(/^\d+\.\d{2}$/);
    expect(firstRow[columnIndexById('taxableBrokerageBalance')]).not.toContain('630,000');
  });
});
