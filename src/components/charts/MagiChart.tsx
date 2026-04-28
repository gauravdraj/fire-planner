import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import type { Scenario, YearBreakdown } from '@/core/projection';
import { getFPLForCoverageYear, type FplRegion, type FplTable } from '@/core/tax/aca';
import type { FilingStatus } from '@/core/types';
import { getChartPalette, getThresholdBandColor, type ChartPalette } from '@/lib/chartPalette';
import { useResolvedTheme } from '@/lib/theme';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

type MagiChartPoint = Readonly<{
  year: number;
  acaMagi: number;
  irmaaMagi: number;
}>;

type AcaBand = Readonly<{
  id: string;
  label: string;
  from: number;
  to: number;
}>;

type IrmaaThreshold = Readonly<{
  label: string;
  value: number;
}>;

type TooltipPayloadItem = Readonly<{
  dataKey?: string | number;
  value?: number | string;
}>;

const ACA_BAND_DEFINITIONS: ReadonlyArray<Readonly<{ label: string; from: number; to: number }>> = [
  { label: '100-150% FPL', from: 1, to: 1.5 },
  { label: '150-200% FPL', from: 1.5, to: 2 },
  { label: '200-300% FPL', from: 2, to: 3 },
  { label: '300-400% FPL', from: 3, to: 4 },
];

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function MagiChart() {
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const themePreference = useUiStore((state) => state.themePreference);
  const resolvedTheme = useResolvedTheme(themePreference);
  const palette = getChartPalette(resolvedTheme);
  const chartData = buildMagiChartData(projectionResults);
  const acaBands = buildAcaFplBands({ projectionResults, scenario });
  const irmaaThresholds = buildIrmaaThresholds(scenario.filingStatus);

  return (
    <section aria-labelledby="magi-chart-heading" className="mt-6 min-w-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50" id="magi-chart-heading">
            MAGI thresholds
          </h2>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            ACA and IRMAA MAGI compared with major planning thresholds.
          </p>
        </div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">nominal dollars</p>
      </div>
      <div
        aria-label="MAGI compared with ACA FPL bands and IRMAA thresholds"
        className="mt-3 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 [contain:paint] dark:border-slate-800 dark:bg-slate-950 dark:shadow-none"
        role="img"
      >
        <div className="h-72 min-w-[40rem] p-3">
          {chartData.length === 0 ? (
            <p className="p-4 text-sm text-slate-600 dark:text-slate-400">No projection data available.</p>
          ) : (
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={chartData} margin={{ bottom: 4, left: 4, right: 28, top: 12 }}>
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
                {acaBands.map((band, index) => (
                  <ReferenceArea
                    fill={getThresholdBandColor(palette, index)}
                    fillOpacity={palette.thresholdBandOpacity}
                    ifOverflow="extendDomain"
                    key={band.id}
                    y1={band.from}
                    y2={band.to}
                  />
                ))}
                {irmaaThresholds.map((threshold) => (
                  <ReferenceLine
                    ifOverflow="extendDomain"
                    key={threshold.label}
                    label={{
                      fill: palette.referenceLabel,
                      fontSize: 11,
                      position: 'right',
                      value: threshold.label,
                    }}
                    stroke={palette.referenceLine}
                    strokeDasharray="4 3"
                    y={threshold.value}
                  />
                ))}
                <Tooltip content={<MagiChartTooltip palette={palette} />} />
                <Legend
                  formatter={(value) => <span style={{ color: palette.legend }}>{String(value)}</span>}
                  wrapperStyle={{ color: palette.legend, fontSize: 12 }}
                />
                <Line
                  dataKey="acaMagi"
                  dot={false}
                  isAnimationActive={false}
                  name="ACA MAGI"
                  stroke={palette.series.magi.acaMagi.stroke}
                  strokeWidth={2}
                  type="linear"
                />
                <Line
                  dataKey="irmaaMagi"
                  dot={false}
                  isAnimationActive={false}
                  name="IRMAA MAGI"
                  stroke={palette.series.magi.irmaaMagi.stroke}
                  strokeWidth={2}
                  type="linear"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-xs text-slate-600 dark:text-slate-400 md:grid-cols-2">
        <div>
          <p className="font-medium text-slate-700 dark:text-slate-300">ACA FPL bands</p>
          {acaBands.length === 0 ? (
            <p className="mt-1">No ACA coverage years in this scenario.</p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {acaBands.map((band) => (
                <li key={band.id}>
                  {band.label}: {DOLLAR_FORMATTER.format(band.from)}-{DOLLAR_FORMATTER.format(band.to)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="font-medium text-slate-700 dark:text-slate-300">IRMAA threshold lines</p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {irmaaThresholds.map((threshold) => (
              <li key={threshold.label}>
                {threshold.label}: {DOLLAR_FORMATTER.format(threshold.value)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function buildMagiChartData(projectionResults: readonly YearBreakdown[]): readonly MagiChartPoint[] {
  return projectionResults.map((breakdown) => ({
    year: breakdown.year,
    acaMagi: breakdown.acaMagi,
    irmaaMagi: breakdown.irmaaMagi,
  }));
}

export function buildAcaFplBands({
  projectionResults,
  scenario,
}: {
  projectionResults: readonly YearBreakdown[];
  scenario: Scenario;
}): readonly AcaBand[] {
  const firstAcaPhase = projectionResults
    .map((breakdown) => ({
      phase: scenario.healthcare.find((entry) => entry.year === breakdown.year && entry.kind === 'aca'),
      year: breakdown.year,
    }))
    .find((entry): entry is { phase: Extract<Scenario['healthcare'][number], { kind: 'aca' }>; year: number } =>
      entry.phase !== undefined,
    );

  if (firstAcaPhase === undefined) {
    return [];
  }

  const region = firstAcaPhase.phase.region ?? 'contiguous';
  const fplTable = getFPLForCoverageYear({
    coverageYear: firstAcaPhase.year,
    fplIndexingRate: scenario.inflationRate,
  });
  const povertyGuideline = getPovertyGuideline(fplTable, firstAcaPhase.phase.householdSize, region);

  return ACA_BAND_DEFINITIONS.map((band) => ({
    id: band.label,
    label: band.label,
    from: povertyGuideline * band.from,
    to: povertyGuideline * band.to,
  }));
}

export function buildIrmaaThresholds(filingStatus: FilingStatus): readonly IrmaaThreshold[] {
  const seen = new Set<number>();
  const thresholds: IrmaaThreshold[] = [];

  CONSTANTS_2026.irmaa.partBTiers[filingStatus].forEach((tier, index) => {
    const threshold = irmaaThresholdForTier(tier);

    if (threshold === null || seen.has(threshold)) {
      return;
    }

    seen.add(threshold);
    thresholds.push({
      label: `IRMAA tier ${index}`,
      value: threshold,
    });
  });

  return thresholds;
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

export function MagiChartTooltip({
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
        <div className="contents">
          <dt style={{ color: palette.tooltip.mutedText }}>ACA MAGI</dt>
          <dd className="text-right font-medium tabular-nums">
            {DOLLAR_FORMATTER.format(valueForSeries(payload, 'acaMagi'))}
          </dd>
        </div>
        <div className="contents">
          <dt style={{ color: palette.tooltip.mutedText }}>IRMAA MAGI</dt>
          <dd className="text-right font-medium tabular-nums">
            {DOLLAR_FORMATTER.format(valueForSeries(payload, 'irmaaMagi'))}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function getPovertyGuideline(table: FplTable, householdSize: number, region: FplRegion): number {
  const regionTable = table[region];

  if (householdSize <= 8) {
    return regionTable.householdSize[householdSize as keyof typeof regionTable.householdSize];
  }

  return regionTable.householdSize[8] + (householdSize - 8) * regionTable.additionalPerPerson;
}

function irmaaThresholdForTier(tier: (typeof CONSTANTS_2026.irmaa.partBTiers)[FilingStatus][number]): number | null {
  if ('magiOver' in tier && typeof tier.magiOver === 'number') {
    return tier.magiOver;
  }

  if ('magiAtLeast' in tier && typeof tier.magiAtLeast === 'number') {
    return tier.magiAtLeast;
  }

  return null;
}

function valueForSeries(payload: readonly TooltipPayloadItem[], key: string): number {
  const value = payload.find((item) => item.dataKey === key)?.value;

  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
