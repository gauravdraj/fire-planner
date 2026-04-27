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
import { useScenarioStore } from '@/store/scenarioStore';

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
  fill: string;
}>;

type IrmaaThreshold = Readonly<{
  label: string;
  value: number;
}>;

type TooltipPayloadItem = Readonly<{
  dataKey?: string | number;
  value?: number | string;
}>;

const ACA_BAND_DEFINITIONS: ReadonlyArray<Readonly<{ label: string; from: number; to: number; fill: string }>> = [
  { label: '100-150% FPL', from: 1, to: 1.5, fill: '#dcfce7' },
  { label: '150-200% FPL', from: 1.5, to: 2, fill: '#bbf7d0' },
  { label: '200-300% FPL', from: 2, to: 3, fill: '#86efac' },
  { label: '300-400% FPL', from: 3, to: 4, fill: '#4ade80' },
];

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function MagiChart() {
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const chartData = buildMagiChartData(projectionResults);
  const acaBands = buildAcaFplBands({ projectionResults, scenario });
  const irmaaThresholds = buildIrmaaThresholds(scenario.filingStatus);

  return (
    <section aria-labelledby="magi-chart-heading" className="mt-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold" id="magi-chart-heading">
            MAGI thresholds
          </h2>
          <p className="text-sm text-slate-600">ACA and IRMAA MAGI compared with major planning thresholds.</p>
        </div>
        <p className="text-xs text-slate-500">nominal dollars</p>
      </div>
      <div
        aria-label="MAGI compared with ACA FPL bands and IRMAA thresholds"
        className="mt-3 rounded-lg border border-slate-200 bg-white"
        role="img"
      >
        <div className="h-72 w-full p-3">
          {chartData.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">No projection data available.</p>
          ) : (
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={chartData} margin={{ bottom: 4, left: 4, right: 28, top: 12 }}>
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
                {acaBands.map((band) => (
                  <ReferenceArea
                    fill={band.fill}
                    fillOpacity={0.28}
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
                      fill: '#7c2d12',
                      fontSize: 11,
                      position: 'right',
                      value: threshold.label,
                    }}
                    stroke="#f97316"
                    strokeDasharray="4 3"
                    y={threshold.value}
                  />
                ))}
                <Tooltip content={<MagiChartTooltip />} />
                <Legend formatter={(value) => String(value)} wrapperStyle={{ fontSize: 12 }} />
                <Line
                  dataKey="acaMagi"
                  dot={false}
                  isAnimationActive={false}
                  name="ACA MAGI"
                  stroke="#047857"
                  strokeWidth={2}
                  type="linear"
                />
                <Line
                  dataKey="irmaaMagi"
                  dot={false}
                  isAnimationActive={false}
                  name="IRMAA MAGI"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  type="linear"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-xs text-slate-600 md:grid-cols-2">
        <div>
          <p className="font-medium text-slate-700">ACA FPL bands</p>
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
          <p className="font-medium text-slate-700">IRMAA threshold lines</p>
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
    fill: band.fill,
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
        <div className="contents">
          <dt className="text-slate-600">ACA MAGI</dt>
          <dd className="text-right font-medium tabular-nums text-slate-950">
            {DOLLAR_FORMATTER.format(valueForSeries(payload, 'acaMagi'))}
          </dd>
        </div>
        <div className="contents">
          <dt className="text-slate-600">IRMAA MAGI</dt>
          <dd className="text-right font-medium tabular-nums text-slate-950">
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
