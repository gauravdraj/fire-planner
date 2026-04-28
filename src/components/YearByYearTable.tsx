import { useEffect, useMemo, useState } from 'react';

import { balanceYearToZero } from '@/core/balanceYearToZero';
import { CONSTANTS_2026 } from '@/core/constants/2026';
import {
  computeYearDisplayMetrics,
  type FplBand,
  type WithdrawalRateBand,
  type YearDisplayMetrics,
} from '@/core/metrics';
import type { Scenario, YearBreakdown } from '@/core/projection';
import { columnExplanations } from '@/lib/columnExplanations';
import { buildYearByYearCsv } from '@/lib/csvExport';
import { buildScenarioJsonExport } from '@/lib/jsonExport';
import { toReal } from '@/lib/realDollars';
import { getStalenessLevel } from '@/lib/staleness';
import { useChangePulse } from '@/lib/useChangePulse';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import {
  getYearByYearColumnLabel,
  yearByYearColumnBands,
  yearByYearColumns,
  type VisibleYearByYearColumnId,
  type YearByYearColumnBand,
  type YearByYearColumnDefinition,
} from '@/lib/yearByYearColumns';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

import { InfoTooltip } from './InfoTooltip';
import { MetricCell, type MetricCellBandType } from './MetricCell';

type YearByYearTableProps = {
  now?: Date | string;
};

type TableRenderContext = Readonly<{
  balanceHints: ReadonlyMap<number, BalanceHint>;
  displayUnit: DisplayUnit;
  scenario: Scenario;
}>;

type DisplayRow = Readonly<{
  breakdown: YearBreakdown;
  isRetirementYear: boolean;
  metrics: YearDisplayMetrics;
}>;

type CellModel = Readonly<{
  value: string;
  pulseValue: string | number;
  className?: string;
  metricBandType?: MetricCellBandType;
  rawNumeric?: number | null;
  marker?: string;
  srText?: string;
  title?: string;
  hint?: string;
  hintTone?: 'balanced' | 'shortfall';
}>;

type TableColumn = YearByYearColumnDefinition &
  Readonly<{
  getCell: (row: DisplayRow, context: TableRenderContext) => CellModel;
}>;

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  style: 'percent',
});

const EM_DASH = '—';
const NEAR_BRACKET_THRESHOLD = 5_000;
const BALANCE_HINT_ROW_CAP = 15;
const BALANCE_HINT_DEBOUNCE_MS = 150;
const BALANCED_CASHFLOW_THRESHOLD = 100;
const DOWNLOAD_BUTTON_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm shadow-slate-900/5 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:shadow-none dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:focus-visible:outline-indigo-400';

type BalanceHintTarget = Readonly<{
  afterTaxCashFlow: number;
  year: number;
}>;

type BalanceHint =
  | Readonly<{
      kind: 'balanced';
    }>
  | Readonly<{
      brokerageWithdrawal: number;
      kind: 'shortfall';
    }>;

const TABLE_CELL_RENDERERS = {
  year: (row) => textCell(String(row.metrics.year), row.metrics.year),
  age: (row) => textCell(String(row.metrics.age), row.metrics.age),
  phase: (row) => textCell(row.metrics.phaseLabel, row.metrics.phaseLabel),
  traditionalBalance: (row, context) =>
    moneyCell(row.breakdown.closingBalances.traditional, row.breakdown.year, context),
  rothBalance: (row, context) => moneyCell(row.breakdown.closingBalances.roth, row.breakdown.year, context),
  hsaBalance: (row, context) => moneyCell(row.breakdown.closingBalances.hsa, row.breakdown.year, context),
  taxableBrokerageBalance: (row, context) =>
    moneyCell(row.breakdown.closingBalances.taxableBrokerage, row.breakdown.year, context),
  cashBalance: (row, context) => moneyCell(row.breakdown.closingBalances.cash, row.breakdown.year, context),
  endingBalance: (row, context) => moneyCell(row.metrics.totalClosingBalance, row.breakdown.year, context),
  brokerageBasisRemaining: (row, context) => moneyCell(row.breakdown.brokerageBasis.closing, row.breakdown.year, context),
  spending: (row, context) => moneyCell(row.breakdown.spending, row.breakdown.year, context),
  wages: (row, context) => optionalMoneyCell(row.metrics.wages, row.breakdown.year, context),
  taxableSocialSecurity: (row, context) =>
    moneyCell(
      row.breakdown.taxableSocialSecurity > 0 || row.metrics.phaseLabel === 'SS claimed'
        ? row.breakdown.taxableSocialSecurity
        : null,
      row.breakdown.year,
      context,
    ),
  traditionalWithdrawals: (row, context) =>
    optionalMoneyCell(row.breakdown.withdrawals.traditional, row.breakdown.year, context),
  rothConversions: (row, context) => optionalMoneyCell(row.breakdown.conversions, row.breakdown.year, context),
  brokerageWithdrawals: (row, context) =>
    optionalMoneyCell(row.breakdown.withdrawals.taxableBrokerage, row.breakdown.year, context),
  realizedLtcg: (row, context) => optionalMoneyCell(row.metrics.ltcgRealized, row.breakdown.year, context),
  agi: (row, context) => moneyCell(row.metrics.totalDisplayedIncome, row.breakdown.year, context),
  federalTax: (row, context) => federalTaxCell(row, context),
  stateTax: (row, context) => moneyCell(row.breakdown.stateTax, row.breakdown.year, context),
  ltcgTax: (row, context) => moneyCell(row.breakdown.ltcgTax, row.breakdown.year, context),
  niit: (row, context) => moneyCell(row.breakdown.niit, row.breakdown.year, context),
  seTax: (row, context) => moneyCell(row.breakdown.seTax, row.breakdown.year, context),
  totalTax: (row, context) => moneyCell(row.breakdown.totalTax, row.breakdown.year, context),
  acaMagi: (row, context) => moneyCell(row.breakdown.acaMagi, row.breakdown.year, context),
  fplPercentage: (row) => fplCell(row.metrics.fplPercentage, row.metrics.fplBand),
  withdrawalRate: (row) => withdrawalRateCell(row.metrics.withdrawalRate, row.metrics.withdrawalRateBand),
  acaPremiumCredit: (row, context) =>
    moneyCell(row.breakdown.acaPremiumCredit?.premiumTaxCredit ?? null, row.breakdown.year, context),
  irmaaPremium: (row, context) =>
    moneyCell(row.breakdown.irmaaPremium?.annualIrmaaSurcharge ?? null, row.breakdown.year, context),
  afterTaxCashFlow: (row, context) => cashflowCell(row.breakdown.afterTaxCashFlow, row.breakdown.year, context),
} satisfies Record<VisibleYearByYearColumnId, TableColumn['getCell']>;

const TABLE_COLUMNS = yearByYearColumns.map((column) => ({
  ...column,
  getCell: TABLE_CELL_RENDERERS[column.id],
})) satisfies readonly TableColumn[];

export function YearByYearTable({ now = new Date() }: YearByYearTableProps) {
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const plan = useScenarioStore((state) => state.plan);
  const formValues = useScenarioStore((state) => state.formValues);
  const customLaw = useScenarioStore((state) => state.customLaw);
  const customLawActive = useScenarioStore((state) => state.customLawActive);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const isStale = getStalenessLevel(CONSTANTS_2026.retrievedAt, now) !== 'fresh';
  const rows = useMemo(
    () => buildDisplayRows({ formValues, projectionResults, scenario }),
    [formValues, projectionResults, scenario],
  );
  const balanceHintTargets = useMemo(
    () => buildBalanceHintTargets(rows, formValues.retirementYear),
    [formValues.retirementYear, rows],
  );
  const [balanceHints, setBalanceHints] = useState<ReadonlyMap<number, BalanceHint>>(() => new Map());
  const computeBalanceHints = useDebouncedCallback((targets: readonly BalanceHintTarget[]) => {
    const nextHints = new Map<number, BalanceHint>();

    for (const target of targets) {
      const result = balanceYearToZero(target.year, scenario, plan, { tolerance: BALANCED_CASHFLOW_THRESHOLD });

      if (Math.abs(target.afterTaxCashFlow) <= BALANCED_CASHFLOW_THRESHOLD) {
        nextHints.set(target.year, { kind: 'balanced' });
      } else if (target.afterTaxCashFlow < 0) {
        nextHints.set(target.year, { brokerageWithdrawal: result.brokerageWithdrawal, kind: 'shortfall' });
      }
    }

    setBalanceHints(nextHints);
  }, BALANCE_HINT_DEBOUNCE_MS);
  const context = { balanceHints, displayUnit, scenario };
  const handleDownloadCsv = () => {
    const csv = buildYearByYearCsv(projectionResults, scenario, formValues, displayUnit);
    downloadCsv(csv, `fire-planner-year-by-year-${scenario.startYear}-${plan.endYear}.csv`);
  };
  const handleDownloadJson = () => {
    const json = buildScenarioJsonExport(formValues, scenario, plan, customLaw, customLawActive);
    downloadJson(json, `fire-planner-scenario-${scenario.startYear}-${plan.endYear}.json`);
  };

  useEffect(() => {
    setBalanceHints(new Map());

    if (balanceHintTargets.length > 0) {
      computeBalanceHints(balanceHintTargets);
    }
  }, [balanceHintTargets, computeBalanceHints]);

  return (
    <section aria-labelledby="year-by-year-heading" className="mt-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50" id="year-by-year-heading">
            Year-by-year projection
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Dense nominal/real outputs share the export column metadata. Scroll sideways on smaller screens.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={DOWNLOAD_BUTTON_CLASS}
            onClick={handleDownloadCsv}
            type="button"
          >
            Download CSV
          </button>
          <button
            className={DOWNLOAD_BUTTON_CLASS}
            onClick={handleDownloadJson}
            type="button"
          >
            Download JSON
          </button>
        </div>
      </div>
      <div
        className="mt-3 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 [contain:paint] dark:border-slate-800 dark:bg-slate-950 dark:shadow-none"
        data-testid="year-table-scroll"
      >
        <table className="w-full min-w-[2700px] border-separate border-spacing-0 text-xs text-slate-700 dark:text-slate-200">
          <thead className="text-slate-600 dark:text-slate-300">
            <tr>
              {yearByYearColumnBands.map((band) => (
                <BandHeader band={band} key={band} />
              ))}
            </tr>
            <tr>
              {TABLE_COLUMNS.map((column) => (
                <ColumnHeader column={column} key={column.id} />
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-950">
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  colSpan={TABLE_COLUMNS.length}
                >
                  No projection rows available for the current inputs.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  className={classNames(
                    'border-b border-slate-200 dark:border-slate-800',
                    row.isRetirementYear && 'border-l-4 border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20',
                  )}
                  data-stale={isStale ? 'true' : undefined}
                  data-testid={`year-table-row-${row.metrics.year}`}
                  key={row.metrics.year}
                >
                  {TABLE_COLUMNS.map((column) => (
                    <TableCell
                      column={column}
                      context={context}
                      dataStale={isStale}
                      key={column.id}
                      row={row}
                    />
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildDisplayRows({
  formValues,
  projectionResults,
  scenario,
}: {
  formValues: Parameters<typeof computeYearDisplayMetrics>[1]['formValues'];
  projectionResults: readonly YearBreakdown[];
  scenario: Scenario;
}): readonly DisplayRow[] {
  return projectionResults.map((breakdown, index) => ({
    breakdown,
    isRetirementYear: breakdown.year === formValues.retirementYear,
    metrics: computeYearDisplayMetrics(breakdown, {
      formValues,
      priorYear: projectionResults[index - 1] ?? null,
      scenario,
    }),
  }));
}

function buildBalanceHintTargets(rows: readonly DisplayRow[], retirementYear: number): readonly BalanceHintTarget[] {
  /*
   * Balance hints can probe many projections, so keep them to the first 15
   * chronological bridge rows and debounce the computation off the keystroke path.
   */
  return rows
    .filter((row) => row.breakdown.year >= retirementYear)
    .sort((left, right) => left.breakdown.year - right.breakdown.year)
    .slice(0, BALANCE_HINT_ROW_CAP)
    .filter((row) => row.breakdown.afterTaxCashFlow < 0 || Math.abs(row.breakdown.afterTaxCashFlow) <= BALANCED_CASHFLOW_THRESHOLD)
    .map((row) => ({
      afterTaxCashFlow: row.breakdown.afterTaxCashFlow,
      year: row.breakdown.year,
    }));
}

function BandHeader({ band }: { band: YearByYearColumnBand }) {
  const columns = TABLE_COLUMNS.filter((column) => column.band === band);
  const firstColumn = columns[0];

  return (
    <th
      className={classNames(
        'sticky top-0 z-30 border-b border-slate-200 bg-slate-100 px-3 py-2 text-center text-[0.68rem] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
        band !== 'Identity' && 'border-l border-slate-300 dark:border-slate-700',
        band === 'Identity' && 'left-0 z-50 text-left',
      )}
      colSpan={columns.length}
      data-band={band}
      scope="colgroup"
    >
      {firstColumn === undefined ? null : band}
    </th>
  );
}

function ColumnHeader({ column }: { column: TableColumn }) {
  const explanation = columnExplanations[column.id];
  const label = getYearByYearColumnLabel(column);
  const labelId = `year-by-year-column-${column.id}`;

  return (
    <th
      aria-label={explanation.label}
      className={classNames(
        'sticky top-8 z-20 border-b border-slate-200 bg-slate-50 px-3 py-2 font-medium tabular-nums text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
        column.align === 'left' ? 'text-left' : 'text-right',
        column.dividerBefore && 'border-l border-slate-300 dark:border-slate-700',
        columnWidthClass(column),
        stickyColumnClass(column, 'bg-slate-50 dark:bg-slate-900', true),
      )}
      scope="col"
    >
      <span className={classNames('inline-flex items-center gap-1.5', column.align === 'left' ? 'justify-start' : 'justify-end')}>
        <span id={labelId}>{label}</span>
        <InfoTooltip ariaLabel={`About ${label}`}>{explanation.description}</InfoTooltip>
      </span>
    </th>
  );
}

function TableCell({
  column,
  context,
  dataStale,
  row,
}: {
  column: TableColumn;
  context: TableRenderContext;
  dataStale: boolean;
  row: DisplayRow;
}) {
  const cell = column.getCell(row, context);
  const isPulsing = useChangePulse(cell.pulseValue);
  const describedById = cell.srText === undefined ? undefined : `year-table-${row.metrics.year}-${column.id}-description`;
  const rowBackground = row.isRetirementYear ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'bg-white dark:bg-slate-950';
  const backgroundClass = isPulsing ? 'bg-yellow-100 dark:bg-yellow-900/40' : (cell.className ?? rowBackground);
  const className = classNames(
    'border-b border-slate-200 px-3 py-2 tabular-nums transition-colors duration-700 data-[stale=true]:opacity-80 motion-reduce:transition-none dark:border-slate-800',
    column.align === 'left' ? 'text-left' : 'text-right',
    column.dividerBefore && 'border-l border-slate-300 dark:border-slate-700',
    columnWidthClass(column),
    stickyColumnClass(column, rowBackground, false),
    row.isRetirementYear && column.sticky === 'year' && 'border-l-4 border-indigo-500',
    backgroundClass,
  );
  const contents = (
    <>
      {cell.metricBandType === undefined ? (
        <span>{cell.value}</span>
      ) : (
        <MetricCell
          bandType={cell.metricBandType}
          className="inline-block rounded px-1"
          displayText={cell.value}
          pulseKey={cell.pulseValue}
          rawNumeric={cell.rawNumeric ?? null}
        />
      )}
      {cell.marker === undefined ? null : (
        <span
          aria-hidden="true"
          className="ml-1 rounded-full bg-amber-200 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/70 dark:text-amber-100"
        >
          {cell.marker}
        </span>
      )}
      {cell.hint === undefined ? null : (
        <div className={balanceHintClassName(cell.hintTone)}>{cell.hint}</div>
      )}
      {cell.srText === undefined ? null : (
        <span className="sr-only" id={describedById}>
          {cell.srText}
        </span>
      )}
    </>
  );

  if (column.id === 'year') {
    return (
      <th
        aria-describedby={describedById}
        className={className}
        data-stale={dataStale ? 'true' : undefined}
        data-testid={`year-table-cell-${row.metrics.year}-${column.id}`}
        scope="row"
        title={cell.title}
      >
        {contents}
      </th>
    );
  }

  return (
    <td
      aria-describedby={describedById}
      className={className}
      data-stale={dataStale ? 'true' : undefined}
      data-testid={`year-table-cell-${row.metrics.year}-${column.id}`}
      title={cell.title}
    >
      {contents}
    </td>
  );
}

function textCell(value: string, pulseValue: string | number): CellModel {
  return { value, pulseValue };
}

function moneyCell(amount: number | null, year: number, context: TableRenderContext): CellModel {
  return {
    value: formatMoney(amount, year, context),
    pulseValue: amount ?? 'not-applicable',
  };
}

function optionalMoneyCell(amount: number | null, year: number, context: TableRenderContext): CellModel {
  return moneyCell(amount === null || amount === 0 ? null : amount, year, context);
}

function cashflowCell(amount: number, year: number, context: TableRenderContext): CellModel {
  const balanceHint = context.balanceHints.get(year);
  const cell: CellModel = {
    ...moneyCell(amount, year, context),
    metricBandType: 'cashflow',
    rawNumeric: amount,
  };

  if (balanceHint === undefined) {
    return cell;
  }

  return { ...cell, hint: formatBalanceHint(balanceHint, year, context), hintTone: balanceHint.kind };
}

function formatBalanceHint(hint: BalanceHint, year: number, context: TableRenderContext): string {
  if (hint.kind === 'balanced') {
    return '→ balanced';
  }

  return `→ +${formatMoney(hint.brokerageWithdrawal, year, context)} to balance`;
}

function federalTaxCell(row: DisplayRow, context: TableRenderContext): CellModel {
  const distanceToNextEdge = row.metrics.federalBracketProximity.distanceToNextEdge;
  const baseCell = moneyCell(row.breakdown.federalTax, row.breakdown.year, context);

  if (distanceToNextEdge === null || distanceToNextEdge >= NEAR_BRACKET_THRESHOLD) {
    return baseCell;
  }

  const distance = formatMoney(distanceToNextEdge, row.breakdown.year, context);
  const srText = `Federal taxable income is ${distance} below the next ordinary bracket edge.`;

  return {
    ...baseCell,
    className: 'bg-amber-50 text-amber-900 dark:bg-amber-950/45 dark:text-amber-100',
    marker: 'near',
    srText,
    title: srText,
  };
}

function fplCell(fplPercentage: number | null, fplBand: FplBand | null): CellModel {
  if (fplPercentage === null || fplBand === null) {
    return {
      value: EM_DASH,
      pulseValue: 'not-applicable',
    };
  }

  return {
    value: PERCENT_FORMATTER.format(fplPercentage),
    pulseValue: fplPercentage,
    metricBandType: 'fpl',
    rawNumeric: fplPercentage,
    srText: fplBandDescription(fplBand),
  };
}

function withdrawalRateCell(withdrawalRate: number | null, withdrawalRateBand: WithdrawalRateBand | null): CellModel {
  if (withdrawalRate === null || withdrawalRateBand === null) {
    return {
      value: EM_DASH,
      pulseValue: 'not-applicable',
    };
  }

  return {
    value: PERCENT_FORMATTER.format(withdrawalRate),
    pulseValue: withdrawalRate,
    metricBandType: 'wdRate',
    rawNumeric: withdrawalRate,
    srText: withdrawalRateBandDescription(withdrawalRateBand),
  };
}

function formatMoney(amount: number | null, year: number, context: TableRenderContext): string {
  if (amount === null) {
    return EM_DASH;
  }

  const displayAmount =
    context.displayUnit === 'real'
      ? toReal(amount, year, context.scenario.startYear, context.scenario.inflationRate)
      : amount;

  return DOLLAR_FORMATTER.format(displayAmount);
}

function stickyColumnClass(column: TableColumn, backgroundClass: string, isHeader: boolean): string {
  const zIndexClass = isHeader ? 'z-40' : 'z-10';

  switch (column.sticky) {
    case 'year':
      return classNames('sticky left-0', zIndexClass, backgroundClass);
    case 'age':
      return classNames('sticky left-20', zIndexClass, backgroundClass);
    case 'phase':
      return classNames(
        'sticky left-[9rem] shadow-[2px_0_0_rgba(148,163,184,0.35)] dark:shadow-[2px_0_0_rgba(51,65,85,0.9)]',
        zIndexClass,
        backgroundClass,
      );
    default:
      return '';
  }
}

function balanceHintClassName(tone: CellModel['hintTone']): string {
  return classNames(
    'mt-0.5 text-[0.65rem] font-medium leading-tight',
    tone === 'balanced'
      ? 'text-emerald-700 dark:text-emerald-300'
      : 'text-amber-700 dark:text-amber-300',
  );
}

function columnWidthClass(column: TableColumn): string {
  switch (column.sticky) {
    case 'year':
      return 'min-w-20 w-20';
    case 'age':
      return 'min-w-16 w-16';
    case 'phase':
      return 'min-w-32 w-32';
    default:
      return column.align === 'left' ? 'min-w-32' : 'min-w-28';
  }
}

function fplBandDescription(band: FplBand): string {
  switch (band) {
    case 'below-aca':
      return 'FPL band: below the normal ACA planning range.';
    case 'aca-low':
      return 'FPL band: lower ACA subsidy range.';
    case 'aca-mid':
      return 'FPL band: middle ACA subsidy range.';
    case 'aca-high':
      return 'FPL band: near the ACA subsidy cliff risk area.';
    case 'above-cliff':
      return 'FPL band: above the ACA subsidy cliff risk area.';
  }
}

function withdrawalRateBandDescription(band: WithdrawalRateBand): string {
  switch (band) {
    case 'safe':
      return 'Withdrawal-rate band: below the 4% caution threshold.';
    case 'caution':
      return 'Withdrawal-rate band: between the 4% caution threshold and 5% danger threshold.';
    case 'danger':
      return 'Withdrawal-rate band: between the 5% danger threshold and 10% catastrophic threshold.';
    case 'catastrophic':
      return 'Withdrawal-rate band: above the 10% catastrophic threshold.';
  }
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, filename);
}

function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
