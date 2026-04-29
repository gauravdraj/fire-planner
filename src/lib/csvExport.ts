import {
  computeYearDisplayMetrics,
  type ProjectionMetricFormValues,
  type YearDisplayMetrics,
} from '@/core/metrics';
import { CONSTANTS_2026 } from '@/core/constants/2026';
import type { Scenario, YearBreakdown } from '@/core/projection';
import type { BasicFormValues } from '@/lib/basicFormMapping';
import { toReal } from '@/lib/realDollars';
import { getYearByYearColumnLabel, yearByYearColumns, type VisibleYearByYearColumnId } from '@/lib/yearByYearColumns';
import type { DisplayUnit } from '@/store/uiStore';

type CsvDisplayRow = Readonly<{
  breakdown: YearBreakdown;
  metrics: YearDisplayMetrics;
}>;

type CsvRenderContext = Readonly<{
  displayUnit: DisplayUnit;
  scenario: Scenario;
}>;

type CsvCellGetter = (row: CsvDisplayRow, context: CsvRenderContext) => string;

const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  style: 'percent',
});

const CSV_CELL_GETTERS = {
  year: (row) => String(row.metrics.year),
  age: (row) => String(row.metrics.age),
  phase: (row) => row.metrics.phaseLabel,
  traditionalBalance: (row, context) =>
    formatMoney(row.breakdown.closingBalances.traditional, row.breakdown.year, context),
  rothBalance: (row, context) => formatMoney(row.breakdown.closingBalances.roth, row.breakdown.year, context),
  hsaBalance: (row, context) => formatMoney(row.breakdown.closingBalances.hsa, row.breakdown.year, context),
  taxableBrokerageBalance: (row, context) =>
    formatMoney(row.breakdown.closingBalances.taxableBrokerage, row.breakdown.year, context),
  cashBalance: (row, context) => formatMoney(row.breakdown.closingBalances.cash, row.breakdown.year, context),
  endingBalance: (row, context) => formatMoney(row.metrics.totalClosingBalance, row.breakdown.year, context),
  brokerageBasisRemaining: (row, context) => formatMoney(row.breakdown.brokerageBasis.closing, row.breakdown.year, context),
  spending: (row, context) => formatMoney(row.breakdown.spending, row.breakdown.year, context),
  wages: (row, context) => formatOptionalMoney(row.metrics.wages, row.breakdown.year, context),
  taxableSocialSecurity: (row, context) =>
    formatMoney(
      row.breakdown.taxableSocialSecurity > 0 || row.metrics.phaseLabel === 'SS claimed'
        ? row.breakdown.taxableSocialSecurity
        : null,
      row.breakdown.year,
      context,
    ),
  traditionalWithdrawals: (row, context) =>
    formatOptionalMoney(row.breakdown.withdrawals.traditional, row.breakdown.year, context),
  rothConversions: (row, context) => formatOptionalMoney(row.breakdown.conversions, row.breakdown.year, context),
  brokerageWithdrawals: (row, context) =>
    formatOptionalMoney(row.breakdown.withdrawals.taxableBrokerage, row.breakdown.year, context),
  realizedLtcg: (row, context) => formatOptionalMoney(row.metrics.ltcgRealized, row.breakdown.year, context),
  agi: (row, context) => formatMoney(row.metrics.totalDisplayedIncome, row.breakdown.year, context),
  federalTax: (row, context) => formatMoney(row.breakdown.federalTax, row.breakdown.year, context),
  stateTax: (row, context) => formatMoney(row.breakdown.stateTax, row.breakdown.year, context),
  ltcgTax: (row, context) => formatMoney(row.breakdown.ltcgTax, row.breakdown.year, context),
  niit: (row, context) => formatMoney(row.breakdown.niit, row.breakdown.year, context),
  seTax: (row, context) => formatMoney(row.breakdown.seTax, row.breakdown.year, context),
  rothConversionRecaptureTax: (row, context) =>
    formatOptionalMoney(row.breakdown.rothConversionRecaptureTax ?? 0, row.breakdown.year, context),
  totalTax: (row, context) => formatMoney(row.breakdown.totalTax, row.breakdown.year, context),
  acaMagi: (row, context) => formatMoney(row.breakdown.acaMagi, row.breakdown.year, context),
  fplPercentage: (row) => formatPercentage(row.metrics.fplPercentage),
  withdrawalRate: (row) => formatPercentage(row.metrics.withdrawalRate),
  acaPremiumCredit: (row, context) =>
    formatMoney(row.breakdown.acaPremiumCredit?.premiumTaxCredit ?? null, row.breakdown.year, context),
  irmaaPremium: (row, context) =>
    formatMoney(row.breakdown.irmaaPremium?.annualIrmaaSurcharge ?? null, row.breakdown.year, context),
  afterTaxCashFlow: (row, context) => formatMoney(row.breakdown.afterTaxCashFlow, row.breakdown.year, context),
} satisfies Record<VisibleYearByYearColumnId, CsvCellGetter>;

export function buildYearByYearCsv(
  rows: readonly YearBreakdown[],
  scenario: Scenario,
  formValues: BasicFormValues,
  displayUnit: DisplayUnit,
): string {
  const generatedAt = new Date().toISOString();
  const context = { displayUnit, scenario };
  const csvRows = rows.map((breakdown, index) => ({
    breakdown,
    metrics: computeYearDisplayMetrics(breakdown, {
      formValues: toProjectionMetricFormValues(formValues),
      priorYear: rows[index - 1] ?? null,
      scenario,
    }),
  }));
  const header = yearByYearColumns.map((column) => getYearByYearColumnLabel(column));
  const dataRows = csvRows.map((row) =>
    yearByYearColumns.map((column) => CSV_CELL_GETTERS[column.id](row, context)),
  );

  return [
    ['Generated at', generatedAt],
    ['Constants retrieved at', CONSTANTS_2026.retrievedAt],
    ['Display unit', displayUnit],
    [buildScenarioSummary(rows, scenario, formValues)],
    [],
    header,
    ...dataRows,
  ]
    .map(formatCsvLine)
    .join('\n');
}

function toProjectionMetricFormValues(formValues: BasicFormValues): ProjectionMetricFormValues {
  return {
    currentYear: formValues.currentYear,
    primaryAge: formValues.primaryAge,
    retirementYear: formValues.retirementYear,
    annualSocialSecurityBenefit: formValues.annualSocialSecurityBenefit,
    socialSecurityClaimAge: formValues.socialSecurityClaimAge,
  };
}

function buildScenarioSummary(
  rows: readonly YearBreakdown[],
  scenario: Scenario,
  formValues: BasicFormValues,
): string {
  const fallbackPlanEndYear = formValues.currentYear + (formValues.planEndAge - formValues.primaryAge);
  const planEndYear = rows.at(-1)?.year ?? fallbackPlanEndYear;
  const startingAccountBalanceTotal = sumBalances(scenario.balances);

  return [
    'Scenario summary',
    `startYear=${scenario.startYear}`,
    `retirementYear=${formValues.retirementYear}`,
    `filingStatus=${scenario.filingStatus}`,
    `planEndYear=${planEndYear}`,
    `startingAccountBalanceTotal=${formatRawMoney(startingAccountBalanceTotal)}`,
  ].join('; ');
}

function formatMoney(amount: number | null, year: number, context: CsvRenderContext): string {
  if (amount === null) {
    return '';
  }

  const displayAmount =
    context.displayUnit === 'real'
      ? toReal(amount, year, context.scenario.startYear, context.scenario.inflationRate)
      : amount;

  return formatRawMoney(displayAmount);
}

function formatOptionalMoney(amount: number | null, year: number, context: CsvRenderContext): string {
  return amount === null || amount === 0 ? '' : formatMoney(amount, year, context);
}

function formatRawMoney(amount: number): string {
  const rounded = roundToCents(amount);

  return Object.is(rounded, -0) ? '0.00' : rounded.toFixed(2);
}

function formatPercentage(value: number | null): string {
  return value === null ? '' : PERCENT_FORMATTER.format(value);
}

function formatCsvLine(values: readonly string[]): string {
  return values.map(escapeCsvCell).join(',');
}

function escapeCsvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function sumBalances(balances: Scenario['balances']): number {
  return balances.cash + balances.hsa + balances.taxableBrokerage + balances.traditional + balances.roth;
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}
