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
import { toReal } from '@/lib/realDollars';
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
  fill: string;
}> = [
  { key: 'federalTax', label: 'Federal tax', fill: '#0f172a' },
  { key: 'stateTax', label: 'State tax', fill: '#334155' },
  { key: 'ltcgTax', label: 'LTCG tax', fill: '#475569' },
  { key: 'niit', label: 'NIIT', fill: '#64748b' },
  { key: 'seTax', label: 'SE tax', fill: '#94a3b8' },
  { key: 'irmaaPremium', label: 'IRMAA premiums', fill: '#f97316' },
  { key: 'acaPremiumCredit', label: 'ACA premium credit', fill: '#16a34a' },
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
  const unitLabel = displayUnit === 'real' ? "today's dollars" : 'nominal dollars';
  const chartData = buildTaxBreakdownChartData({ displayUnit, projectionResults, scenario });

  return (
    <section aria-labelledby="tax-breakdown-chart-heading" className="mt-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold" id="tax-breakdown-chart-heading">
            Tax breakdown
          </h2>
          <p className="text-sm text-slate-600">Annual tax components, with ACA premium credits shown below zero.</p>
        </div>
        <p className="text-xs text-slate-500">{unitLabel}</p>
      </div>
      <div
        aria-label="Annual tax breakdown with ACA premium credit as a negative value"
        className="mt-3 rounded-lg border border-slate-200 bg-white"
        role="img"
      >
        <div className="h-72 w-full p-3">
          {chartData.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">No projection data available.</p>
          ) : (
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={chartData} margin={{ bottom: 4, left: 4, right: 12, top: 12 }}>
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
                <ReferenceLine stroke="#94a3b8" y={0} />
                <Tooltip content={<TaxBreakdownChartTooltip />} />
                <Legend formatter={(value) => String(value)} wrapperStyle={{ fontSize: 12 }} />
                {TAX_SERIES.map((series) => (
                  <Bar
                    dataKey={series.key}
                    fill={series.fill}
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
      <p className="mt-2 text-xs text-slate-500">
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
  payload,
}: {
  active?: boolean;
  label?: number | string;
  payload?: readonly TooltipPayloadItem[];
}) {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <p className="font-medium text-slate-950">{label}</p>
      <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
        {TAX_SERIES.map((series) => (
          <div className="contents" key={series.key}>
            <dt className="text-slate-600">{series.label}</dt>
            <dd className="text-right font-medium tabular-nums text-slate-950">
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
