import { CONSTANTS_2026 } from '@/core/constants/2026';
import {
  computeYearDisplayMetrics,
  type FplBand,
  type WithdrawalRateBand,
  type YearDisplayMetrics,
} from '@/core/metrics';
import type { Scenario, YearBreakdown } from '@/core/projection';
import { columnExplanations, type TableColumnId } from '@/lib/columnExplanations';
import { toReal } from '@/lib/realDollars';
import { getStalenessLevel } from '@/lib/staleness';
import { useChangePulse } from '@/lib/useChangePulse';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

import { InfoTooltip } from './InfoTooltip';
import { MetricCell, type MetricCellBandType } from './MetricCell';

type YearByYearTableProps = {
  now?: Date | string;
};

type TableBand = 'Identity' | 'Balances' | 'Income' | 'Tax' | 'KPIs';

type StickyColumn = 'year' | 'age' | 'phase';

type TableRenderContext = Readonly<{
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
}>;

type TableColumn = Readonly<{
  id: TableColumnId;
  band: TableBand;
  label?: string;
  align?: 'left' | 'right';
  sticky?: StickyColumn;
  dividerBefore?: boolean;
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
const HEADER_BANDS = ['Identity', 'Balances', 'Income', 'Tax', 'KPIs'] as const satisfies readonly TableBand[];
const NEAR_BRACKET_THRESHOLD = 5_000;

const TABLE_COLUMNS: readonly TableColumn[] = [
  {
    id: 'year',
    band: 'Identity',
    sticky: 'year',
    getCell: (row) => textCell(String(row.metrics.year), row.metrics.year),
  },
  {
    id: 'age',
    band: 'Identity',
    sticky: 'age',
    getCell: (row) => textCell(String(row.metrics.age), row.metrics.age),
  },
  {
    id: 'phase',
    band: 'Identity',
    sticky: 'phase',
    align: 'left',
    getCell: (row) => textCell(row.metrics.phaseLabel, row.metrics.phaseLabel),
  },
  {
    id: 'traditionalBalance',
    band: 'Balances',
    label: 'Trad',
    dividerBefore: true,
    getCell: (row, context) => moneyCell(row.breakdown.closingBalances.traditional, row.breakdown.year, context),
  },
  {
    id: 'rothBalance',
    band: 'Balances',
    label: 'Roth',
    getCell: (row, context) => moneyCell(row.breakdown.closingBalances.roth, row.breakdown.year, context),
  },
  {
    id: 'taxableBrokerageBalance',
    band: 'Balances',
    label: 'Taxable',
    getCell: (row, context) => moneyCell(row.breakdown.closingBalances.taxableBrokerage, row.breakdown.year, context),
  },
  {
    id: 'cashBalance',
    band: 'Balances',
    label: 'Cash',
    getCell: (row, context) => moneyCell(row.breakdown.closingBalances.cash, row.breakdown.year, context),
  },
  {
    id: 'endingBalance',
    band: 'Balances',
    label: 'Total',
    getCell: (row, context) => moneyCell(row.metrics.totalClosingBalance, row.breakdown.year, context),
  },
  {
    id: 'brokerageBasisRemaining',
    band: 'Balances',
    label: 'Basis',
    getCell: (row, context) => moneyCell(row.breakdown.brokerageBasis.closing, row.breakdown.year, context),
  },
  {
    id: 'wages',
    band: 'Income',
    dividerBefore: true,
    getCell: (row, context) => optionalMoneyCell(row.metrics.wages, row.breakdown.year, context),
  },
  {
    id: 'taxableSocialSecurity',
    band: 'Income',
    label: 'Taxable SS',
    getCell: (row, context) =>
      moneyCell(
        row.breakdown.taxableSocialSecurity > 0 || row.metrics.phaseLabel === 'SS claimed'
          ? row.breakdown.taxableSocialSecurity
          : null,
        row.breakdown.year,
        context,
      ),
  },
  {
    id: 'traditionalWithdrawals',
    band: 'Income',
    label: 'IRA dist.',
    getCell: (row, context) => optionalMoneyCell(row.breakdown.withdrawals.traditional, row.breakdown.year, context),
  },
  {
    id: 'rothConversions',
    band: 'Income',
    label: 'Roth conv.',
    getCell: (row, context) => optionalMoneyCell(row.breakdown.conversions, row.breakdown.year, context),
  },
  {
    id: 'brokerageWithdrawals',
    band: 'Income',
    label: 'Brokerage wd.',
    getCell: (row, context) => optionalMoneyCell(row.breakdown.withdrawals.taxableBrokerage, row.breakdown.year, context),
  },
  {
    id: 'realizedLtcg',
    band: 'Income',
    label: 'Realized gain/loss',
    getCell: (row, context) => optionalMoneyCell(row.metrics.ltcgRealized, row.breakdown.year, context),
  },
  {
    id: 'agi',
    band: 'Income',
    label: 'AGI',
    getCell: (row, context) => moneyCell(row.metrics.totalDisplayedIncome, row.breakdown.year, context),
  },
  {
    id: 'federalTax',
    band: 'Tax',
    label: 'Federal',
    dividerBefore: true,
    getCell: (row, context) => federalTaxCell(row, context),
  },
  {
    id: 'stateTax',
    band: 'Tax',
    label: 'State',
    getCell: (row, context) => moneyCell(row.breakdown.stateTax, row.breakdown.year, context),
  },
  {
    id: 'ltcgTax',
    band: 'Tax',
    label: 'LTCG',
    getCell: (row, context) => moneyCell(row.breakdown.ltcgTax, row.breakdown.year, context),
  },
  {
    id: 'niit',
    band: 'Tax',
    label: 'NIIT',
    getCell: (row, context) => moneyCell(row.breakdown.niit, row.breakdown.year, context),
  },
  {
    id: 'seTax',
    band: 'Tax',
    label: 'SE',
    getCell: (row, context) => moneyCell(row.breakdown.seTax, row.breakdown.year, context),
  },
  {
    id: 'totalTax',
    band: 'Tax',
    label: 'Total tax',
    getCell: (row, context) => moneyCell(row.breakdown.totalTax, row.breakdown.year, context),
  },
  {
    id: 'acaMagi',
    band: 'KPIs',
    label: 'ACA MAGI',
    dividerBefore: true,
    getCell: (row, context) => moneyCell(row.breakdown.acaMagi, row.breakdown.year, context),
  },
  {
    id: 'fplPercentage',
    band: 'KPIs',
    label: 'FPL %',
    getCell: (row) => fplCell(row.metrics.fplPercentage, row.metrics.fplBand),
  },
  {
    id: 'withdrawalRate',
    band: 'KPIs',
    label: 'Withdrawal rate',
    getCell: (row) => withdrawalRateCell(row.metrics.withdrawalRate, row.metrics.withdrawalRateBand),
  },
  {
    id: 'acaPremiumCredit',
    band: 'KPIs',
    label: 'ACA PTC',
    getCell: (row, context) =>
      moneyCell(row.breakdown.acaPremiumCredit?.premiumTaxCredit ?? null, row.breakdown.year, context),
  },
  {
    id: 'irmaaPremium',
    band: 'KPIs',
    label: 'IRMAA',
    getCell: (row, context) =>
      moneyCell(row.breakdown.irmaaPremium?.annualIrmaaSurcharge ?? null, row.breakdown.year, context),
  },
  {
    id: 'afterTaxCashFlow',
    band: 'KPIs',
    label: 'After-tax cash flow',
    getCell: (row, context) => cashflowCell(row.breakdown.afterTaxCashFlow, row.breakdown.year, context),
  },
];

export function YearByYearTable({ now = new Date() }: YearByYearTableProps) {
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const formValues = useScenarioStore((state) => state.formValues);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const isStale = getStalenessLevel(CONSTANTS_2026.retrievedAt, now) !== 'fresh';
  const rows = buildDisplayRows({ formValues, projectionResults, scenario });
  const context = { displayUnit, scenario };

  return (
    <section aria-labelledby="year-by-year-heading" className="mt-6">
      <h2 className="text-lg font-semibold" id="year-by-year-heading">
        Year-by-year projection
      </h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200" data-testid="year-table-scroll">
        <table className="min-w-[2700px] w-full border-separate border-spacing-0 text-xs">
          <thead className="text-slate-600">
            <tr>
              {HEADER_BANDS.map((band) => (
                <BandHeader band={band} key={band} />
              ))}
            </tr>
            <tr>
              {TABLE_COLUMNS.map((column) => (
                <ColumnHeader column={column} key={column.id} />
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((row) => (
              <tr
                className={classNames(
                  'border-b border-slate-200',
                  row.isRetirementYear && 'border-l-4 border-indigo-500 bg-indigo-50/40',
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
            ))}
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

function BandHeader({ band }: { band: TableBand }) {
  const columns = TABLE_COLUMNS.filter((column) => column.band === band);
  const firstColumn = columns[0];

  return (
    <th
      className={classNames(
        'sticky top-0 z-30 border-b border-slate-200 bg-slate-100 px-3 py-2 text-center text-[0.68rem] font-semibold uppercase tracking-wide text-slate-600',
        band !== 'Identity' && 'border-l border-slate-300',
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
  const label = column.label ?? explanation.label;
  const labelId = `year-by-year-column-${column.id}`;

  return (
    <th
      aria-label={explanation.label}
      className={classNames(
        'sticky top-8 z-20 border-b border-slate-200 bg-slate-50 px-3 py-2 font-medium tabular-nums',
        column.align === 'left' ? 'text-left' : 'text-right',
        column.dividerBefore && 'border-l border-slate-300',
        columnWidthClass(column),
        stickyColumnClass(column, 'bg-slate-50', true),
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
  const rowBackground = row.isRetirementYear ? 'bg-indigo-50' : 'bg-white';
  const backgroundClass = isPulsing ? 'bg-yellow-100' : (cell.className ?? rowBackground);
  const className = classNames(
    'border-b border-slate-200 px-3 py-2 tabular-nums transition-colors duration-700',
    column.align === 'left' ? 'text-left' : 'text-right',
    column.dividerBefore && 'border-l border-slate-300',
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
          className="ml-1 rounded-full bg-amber-200 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-900"
        >
          {cell.marker}
        </span>
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
  return {
    ...moneyCell(amount, year, context),
    metricBandType: 'cashflow',
    rawNumeric: amount,
  };
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
    className: 'bg-amber-50 text-amber-900',
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
      return classNames('sticky left-[9rem] shadow-[2px_0_0_rgba(148,163,184,0.35)]', zIndexClass, backgroundClass);
    default:
      return '';
  }
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
