import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import type { Scenario, YearBreakdown } from '@/core/projection';
import { getChartPalette, type ChartPalette } from '@/lib/chartPalette';
import { toReal } from '@/lib/realDollars';
import { getStalenessLevel } from '@/lib/staleness';
import { useResolvedTheme } from '@/lib/theme';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

type BalancesChartProps = {
  now?: Date | string;
  variant?: 'compact' | 'default';
};

type BalanceSeriesKey = 'traditional' | 'roth' | 'hsa' | 'taxableBrokerage' | 'cash';

type BalanceChartPoint = Readonly<{
  year: number;
  traditional: number;
  roth: number;
  hsa: number;
  taxableBrokerage: number;
  cash: number;
  total: number;
}>;

type TooltipPayloadItem = Readonly<{
  dataKey?: string | number;
  value?: number | string;
}>;

const BALANCE_SERIES: ReadonlyArray<{
  key: BalanceSeriesKey;
  label: string;
}> = [
  { key: 'traditional', label: 'Traditional' },
  { key: 'roth', label: 'Roth' },
  { key: 'hsa', label: 'HSA' },
  { key: 'taxableBrokerage', label: 'Taxable brokerage' },
  { key: 'cash', label: 'Cash' },
];

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function BalancesChart({ now = new Date(), variant = 'default' }: BalancesChartProps) {
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const themePreference = useUiStore((state) => state.themePreference);
  const resolvedTheme = useResolvedTheme(themePreference);
  const palette = getChartPalette(resolvedTheme);
  const isCompact = variant === 'compact';
  const isStale = getStalenessLevel(CONSTANTS_2026.retrievedAt, now) !== 'fresh';
  const unitLabel = displayUnit === 'real' ? "today's dollars" : 'nominal dollars';
  const chartData = buildBalancesChartData({ displayUnit, projectionResults, scenario });

  return (
    <section aria-labelledby="balances-chart-heading" className={isCompact ? 'mt-4 min-w-0' : 'mt-6 min-w-0'}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className={isCompact ? 'text-base font-semibold text-slate-950 dark:text-slate-50' : 'text-lg font-semibold text-slate-950 dark:text-slate-50'}
            id="balances-chart-heading"
          >
            Account balances
          </h2>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            Stacked closing balances by projection year.
          </p>
        </div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{unitLabel}</p>
      </div>
      <div
        aria-label="Stacked account balances over projection years"
        className="mt-3 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 [contain:paint] dark:border-slate-800 dark:bg-slate-950 dark:shadow-none"
        data-stale={isStale ? 'true' : undefined}
        role="img"
      >
        <div className={isCompact ? 'h-64 min-w-[22rem] p-2 xl:min-w-0' : 'h-72 min-w-[40rem] p-3'}>
          {chartData.length === 0 ? (
            <p className="p-4 text-sm text-slate-600 dark:text-slate-400">No projection data available.</p>
          ) : (
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart
                data={chartData}
                margin={isCompact ? { bottom: 0, left: 0, right: 4, top: 8 } : { bottom: 4, left: 4, right: 12, top: 12 }}
              >
                <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                <XAxis
                  axisLine={false}
                  dataKey="year"
                  tick={{ fill: palette.axis, fontSize: isCompact ? 11 : 12 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: palette.axis, fontSize: isCompact ? 11 : 12 }}
                  tickFormatter={formatCompactDollarTick}
                  tickLine={false}
                  width={isCompact ? 56 : 72}
                />
                <Tooltip content={<BalancesChartTooltip palette={palette} />} />
                <Legend
                  formatter={(value) => <span style={{ color: palette.legend }}>{String(value)}</span>}
                  wrapperStyle={{ color: palette.legend, fontSize: isCompact ? 11 : 12 }}
                />
                {BALANCE_SERIES.map((series) => (
                  <Area
                    dataKey={series.key}
                    fill={palette.series.balances[series.key].fill}
                    fillOpacity={0.7}
                    isAnimationActive={false}
                    key={series.key}
                    name={series.label}
                    stackId="balances"
                    stroke={palette.series.balances[series.key].stroke}
                    type="linear"
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

export function buildBalancesChartData({
  displayUnit,
  projectionResults,
  scenario,
}: {
  displayUnit: DisplayUnit;
  projectionResults: readonly YearBreakdown[];
  scenario: Scenario;
}): readonly BalanceChartPoint[] {
  return projectionResults.map((breakdown) => {
    const traditional = displayBalance(breakdown.closingBalances.traditional, breakdown.year, scenario, displayUnit);
    const roth = displayBalance(breakdown.closingBalances.roth, breakdown.year, scenario, displayUnit);
    const hsa = displayBalance(breakdown.closingBalances.hsa, breakdown.year, scenario, displayUnit);
    const taxableBrokerage = displayBalance(
      breakdown.closingBalances.taxableBrokerage,
      breakdown.year,
      scenario,
      displayUnit,
    );
    const cash = displayBalance(breakdown.closingBalances.cash, breakdown.year, scenario, displayUnit);

    return {
      year: breakdown.year,
      traditional,
      roth,
      hsa,
      taxableBrokerage,
      cash,
      total: traditional + roth + hsa + taxableBrokerage + cash,
    };
  });
}

export function formatCompactDollarTick(value: number | string): string {
  const amount = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(amount)) {
    return '$0';
  }

  const absoluteAmount = Math.abs(amount);
  const prefix = amount < 0 ? '-$' : '$';

  if (absoluteAmount >= 1_000_000) {
    return `${prefix}${(absoluteAmount / 1_000_000).toFixed(1)}M`;
  }

  if (absoluteAmount >= 1_000) {
    return `${prefix}${(absoluteAmount / 1_000).toFixed(1)}k`;
  }

  return DOLLAR_FORMATTER.format(amount);
}

export function BalancesChartTooltip({
  active,
  label,
  palette = getChartPalette('light'),
  payload,
}: {
  active?: boolean;
  label?: number | string;
  palette?: ChartPalette;
  payload?: readonly TooltipPayloadItem[];
}) {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null;
  }

  const rows = BALANCE_SERIES.map((series) => ({
    ...series,
    value: valueForSeries(payload, series.key),
  }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div
      className="rounded-lg p-3 text-sm shadow-lg shadow-slate-950/10"
      style={{
        backgroundColor: palette.tooltip.background,
        border: `1px solid ${palette.tooltip.border}`,
        color: palette.tooltip.text,
      }}
    >
      <p className="font-medium">{label}</p>
      <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
        {rows.map((row) => (
          <div className="contents" key={row.key}>
            <dt style={{ color: palette.tooltip.mutedText }}>{row.label}</dt>
            <dd className="text-right font-medium tabular-nums">{DOLLAR_FORMATTER.format(row.value)}</dd>
          </div>
        ))}
        <div className="contents">
          <dt
            className="pt-1 font-medium"
            style={{ borderTop: `1px solid ${palette.tooltip.divider}`, color: palette.tooltip.text }}
          >
            Total
          </dt>
          <dd
            className="pt-1 text-right font-semibold tabular-nums"
            style={{ borderTop: `1px solid ${palette.tooltip.divider}` }}
          >
            {DOLLAR_FORMATTER.format(total)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function displayBalance(amount: number, year: number, scenario: Scenario, displayUnit: DisplayUnit): number {
  return displayUnit === 'real' ? toReal(amount, year, scenario.startYear, scenario.inflationRate) : amount;
}

function valueForSeries(payload: readonly TooltipPayloadItem[], key: BalanceSeriesKey): number {
  const value = payload.find((item) => item.dataKey === key)?.value;

  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
