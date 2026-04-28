import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { Scenario, YearBreakdown } from '@/core/projection';
import { getChartPalette, type ChartPalette } from '@/lib/chartPalette';
import { toReal } from '@/lib/realDollars';
import { useResolvedTheme } from '@/lib/theme';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

type TaxBreakdownKey =
  | 'federalTax'
  | 'stateTax'
  | 'ltcgTax'
  | 'niit'
  | 'seTax'
  | 'irmaaPremium'
  | 'acaPremiumCredit';

type TaxBreakdownPoint = Readonly<Record<TaxBreakdownKey, number> & { year: number }>;

type TooltipPayloadItem = Readonly<{
  dataKey?: string | number;
  value?: number | string;
}>;

const TAX_SERIES: ReadonlyArray<{
  key: TaxBreakdownKey;
  label: string;
}> = [
  { key: 'federalTax', label: 'Federal tax' },
  { key: 'stateTax', label: 'State tax' },
  { key: 'ltcgTax', label: 'LTCG tax' },
  { key: 'niit', label: 'NIIT' },
  { key: 'seTax', label: 'SE tax' },
  { key: 'irmaaPremium', label: 'IRMAA premiums' },
  { key: 'acaPremiumCredit', label: 'ACA premium credit' },
];

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function TaxBreakdownChart() {
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const themePreference = useUiStore((state) => state.themePreference);
  const resolvedTheme = useResolvedTheme(themePreference);
  const palette = getChartPalette(resolvedTheme);
  const unitLabel = displayUnit === 'real' ? "today's dollars" : 'nominal dollars';
  const chartData = buildTaxBreakdownChartData({ displayUnit, projectionResults, scenario });

  return (
    <section aria-labelledby="tax-breakdown-chart-heading" className="mt-6 min-w-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50" id="tax-breakdown-chart-heading">
            Tax breakdown
          </h2>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            Annual tax components, with ACA premium credits shown below zero.
          </p>
        </div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{unitLabel}</p>
      </div>
      <div
        aria-label="Annual tax breakdown with ACA premium credit as a negative value"
        className="mt-3 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 [contain:paint] dark:border-slate-800 dark:bg-slate-950 dark:shadow-none"
        role="img"
      >
        <div className="h-72 min-w-[40rem] p-3">
          {chartData.length === 0 ? (
            <p className="p-4 text-sm text-slate-600 dark:text-slate-400">No projection data available.</p>
          ) : (
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={chartData} margin={{ bottom: 4, left: 4, right: 12, top: 12 }}>
                <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                <XAxis
                  axisLine={false}
                  dataKey="year"
                  tick={{ fill: palette.axis, fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: palette.axis, fontSize: 12 }}
                  tickFormatter={formatCompactDollarTick}
                  tickLine={false}
                  width={72}
                />
                <ReferenceLine stroke={palette.zeroLine} y={0} />
                <Tooltip content={<TaxBreakdownChartTooltip palette={palette} />} />
                <Legend
                  formatter={(value) => <span style={{ color: palette.legend }}>{String(value)}</span>}
                  wrapperStyle={{ color: palette.legend, fontSize: 12 }}
                />
                {TAX_SERIES.map((series) => (
                  <Bar
                    dataKey={series.key}
                    fill={palette.series.tax[series.key].fill}
                    isAnimationActive={false}
                    key={series.key}
                    name={series.label}
                    stackId="taxes"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        ACA premium credit is plotted as a negative value so it remains visually distinct from taxes and premiums.
      </p>
    </section>
  );
}

export function buildTaxBreakdownChartData({
  displayUnit,
  projectionResults,
  scenario,
}: {
  displayUnit: DisplayUnit;
  projectionResults: readonly YearBreakdown[];
  scenario: Scenario;
}): readonly TaxBreakdownPoint[] {
  return projectionResults.map((breakdown) => ({
    year: breakdown.year,
    federalTax: displayAmount(breakdown.federalTax, breakdown.year, scenario, displayUnit),
    stateTax: displayAmount(breakdown.stateTax, breakdown.year, scenario, displayUnit),
    ltcgTax: displayAmount(breakdown.ltcgTax, breakdown.year, scenario, displayUnit),
    niit: displayAmount(breakdown.niit, breakdown.year, scenario, displayUnit),
    seTax: displayAmount(breakdown.seTax, breakdown.year, scenario, displayUnit),
    irmaaPremium: displayAmount(breakdown.irmaaPremium?.annualIrmaaSurcharge ?? 0, breakdown.year, scenario, displayUnit),
    acaPremiumCredit: -displayAmount(
      breakdown.aptcReconciliation?.netPremiumTaxCredit ?? breakdown.acaPremiumCredit?.premiumTaxCredit ?? 0,
      breakdown.year,
      scenario,
      displayUnit,
    ),
  }));
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

export function TaxBreakdownChartTooltip({
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
        {TAX_SERIES.map((series) => (
          <div className="contents" key={series.key}>
            <dt style={{ color: palette.tooltip.mutedText }}>{series.label}</dt>
            <dd className="text-right font-medium tabular-nums">
              {DOLLAR_FORMATTER.format(valueForSeries(payload, series.key))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function displayAmount(amount: number, year: number, scenario: Scenario, displayUnit: DisplayUnit): number {
  return displayUnit === 'real' ? toReal(amount, year, scenario.startYear, scenario.inflationRate) : amount;
}

function valueForSeries(payload: readonly TooltipPayloadItem[], key: TaxBreakdownKey): number {
  const value = payload.find((item) => item.dataKey === key)?.value;

  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
