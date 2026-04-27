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
import { toReal } from '@/lib/realDollars';
import { getStalenessLevel } from '@/lib/staleness';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

type BalancesChartProps = {
  now?: Date | string;
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
  stroke: string;
  fill: string;
}> = [
  { key: 'traditional', label: 'Traditional', stroke: '#0f172a', fill: '#334155' },
  { key: 'roth', label: 'Roth', stroke: '#4338ca', fill: '#4f46e5' },
  { key: 'hsa', label: 'HSA', stroke: '#047857', fill: '#10b981' },
  { key: 'taxableBrokerage', label: 'Taxable brokerage', stroke: '#64748b', fill: '#94a3b8' },
  { key: 'cash', label: 'Cash', stroke: '#94a3b8', fill: '#cbd5e1' },
];

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function BalancesChart({ now = new Date() }: BalancesChartProps) {
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const isStale = getStalenessLevel(CONSTANTS_2026.retrievedAt, now) !== 'fresh';
  const unitLabel = displayUnit === 'real' ? "today's dollars" : 'nominal dollars';
  const chartData = buildBalancesChartData({ displayUnit, projectionResults, scenario });

  return (
    <section aria-labelledby="balances-chart-heading" className="mt-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold" id="balances-chart-heading">
            Account balances
          </h2>
          <p className="text-sm text-slate-600">Stacked closing balances by projection year.</p>
        </div>
        <p className="text-xs text-slate-500">{unitLabel}</p>
      </div>
      <div
        aria-label="Stacked account balances over projection years"
        className="mt-3 rounded-lg border border-slate-200 bg-white"
        data-stale={isStale ? 'true' : undefined}
        role="img"
      >
        <div className="h-72 w-full p-3">
          {chartData.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">No projection data available.</p>
          ) : (
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={chartData} margin={{ bottom: 4, left: 4, right: 12, top: 12 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  axisLine={false}
                  dataKey="year"
                  tick={{ fill: '#475569', fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: '#475569', fontSize: 12 }}
                  tickFormatter={formatCompactDollarTick}
                  tickLine={false}
                  width={72}
                />
                <Tooltip content={<BalancesChartTooltip />} />
                <Legend formatter={(value) => String(value)} wrapperStyle={{ fontSize: 12 }} />
                {BALANCE_SERIES.map((series) => (
                  <Area
                    dataKey={series.key}
                    fill={series.fill}
                    fillOpacity={0.7}
                    isAnimationActive={false}
                    key={series.key}
                    name={series.label}
                    stackId="balances"
                    stroke={series.stroke}
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
  payload,
}: {
  active?: boolean;
  label?: number | string;
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
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <p className="font-medium text-slate-950">{label}</p>
      <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
        {rows.map((row) => (
          <div className="contents" key={row.key}>
            <dt className="text-slate-600">{row.label}</dt>
            <dd className="text-right font-medium tabular-nums text-slate-950">{DOLLAR_FORMATTER.format(row.value)}</dd>
          </div>
        ))}
        <div className="contents">
          <dt className="border-t border-slate-200 pt-1 font-medium text-slate-700">Total</dt>
          <dd className="border-t border-slate-200 pt-1 text-right font-semibold tabular-nums text-slate-950">
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
