import type { ResolvedTheme } from '@/lib/theme';

type BalanceSeriesKey = 'traditional' | 'roth' | 'hsa' | 'taxableBrokerage' | 'cash';
type MagiSeriesKey = 'acaMagi' | 'irmaaMagi';
type TaxSeriesKey =
  | 'federalTax'
  | 'stateTax'
  | 'ltcgTax'
  | 'niit'
  | 'seTax'
  | 'irmaaPremium'
  | 'acaPremiumCredit';

type SeriesColor = Readonly<{
  fill: string;
  stroke: string;
}>;

type TooltipPalette = Readonly<{
  background: string;
  border: string;
  divider: string;
  mutedText: string;
  text: string;
}>;

export type ChartPalette = Readonly<{
  axis: string;
  grid: string;
  legend: string;
  referenceLabel: string;
  referenceLine: string;
  thresholdBandOpacity: number;
  thresholdBands: readonly string[];
  tooltip: TooltipPalette;
  zeroLine: string;
  series: Readonly<{
    balances: Readonly<Record<BalanceSeriesKey, SeriesColor>>;
    magi: Readonly<Record<MagiSeriesKey, SeriesColor>>;
    tax: Readonly<Record<TaxSeriesKey, SeriesColor>>;
  }>;
}>;

const LIGHT_CHART_PALETTE: ChartPalette = {
  axis: '#475569',
  grid: '#e2e8f0',
  legend: '#334155',
  referenceLabel: '#7c2d12',
  referenceLine: '#f97316',
  thresholdBandOpacity: 0.28,
  thresholdBands: ['#dcfce7', '#bbf7d0', '#86efac', '#4ade80'],
  tooltip: {
    background: '#ffffff',
    border: '#e2e8f0',
    divider: '#e2e8f0',
    mutedText: '#475569',
    text: '#0f172a',
  },
  zeroLine: '#94a3b8',
  series: {
    balances: {
      traditional: { stroke: '#0f172a', fill: '#334155' },
      roth: { stroke: '#4338ca', fill: '#4f46e5' },
      hsa: { stroke: '#047857', fill: '#10b981' },
      taxableBrokerage: { stroke: '#64748b', fill: '#94a3b8' },
      cash: { stroke: '#94a3b8', fill: '#cbd5e1' },
    },
    magi: {
      acaMagi: { stroke: '#047857', fill: '#047857' },
      irmaaMagi: { stroke: '#7c3aed', fill: '#7c3aed' },
    },
    tax: {
      federalTax: { stroke: '#0f172a', fill: '#0f172a' },
      stateTax: { stroke: '#334155', fill: '#334155' },
      ltcgTax: { stroke: '#475569', fill: '#475569' },
      niit: { stroke: '#64748b', fill: '#64748b' },
      seTax: { stroke: '#94a3b8', fill: '#94a3b8' },
      irmaaPremium: { stroke: '#f97316', fill: '#f97316' },
      acaPremiumCredit: { stroke: '#16a34a', fill: '#16a34a' },
    },
  },
};

const DARK_CHART_PALETTE: ChartPalette = {
  axis: '#cbd5e1',
  grid: '#334155',
  legend: '#cbd5e1',
  referenceLabel: '#fdba74',
  referenceLine: '#fb923c',
  thresholdBandOpacity: 0.2,
  thresholdBands: ['#052e16', '#064e3b', '#065f46', '#047857'],
  tooltip: {
    background: '#0f172a',
    border: '#334155',
    divider: '#334155',
    mutedText: '#cbd5e1',
    text: '#f8fafc',
  },
  zeroLine: '#64748b',
  series: {
    balances: {
      traditional: { stroke: '#f8fafc', fill: '#cbd5e1' },
      roth: { stroke: '#c4b5fd', fill: '#818cf8' },
      hsa: { stroke: '#86efac', fill: '#34d399' },
      taxableBrokerage: { stroke: '#cbd5e1', fill: '#64748b' },
      cash: { stroke: '#94a3b8', fill: '#334155' },
    },
    magi: {
      acaMagi: { stroke: '#34d399', fill: '#34d399' },
      irmaaMagi: { stroke: '#a78bfa', fill: '#a78bfa' },
    },
    tax: {
      federalTax: { stroke: '#e2e8f0', fill: '#e2e8f0' },
      stateTax: { stroke: '#cbd5e1', fill: '#cbd5e1' },
      ltcgTax: { stroke: '#94a3b8', fill: '#94a3b8' },
      niit: { stroke: '#64748b', fill: '#64748b' },
      seTax: { stroke: '#475569', fill: '#475569' },
      irmaaPremium: { stroke: '#fb923c', fill: '#fb923c' },
      acaPremiumCredit: { stroke: '#34d399', fill: '#34d399' },
    },
  },
};

export function getChartPalette(resolvedTheme: ResolvedTheme): ChartPalette {
  return resolvedTheme === 'dark' ? DARK_CHART_PALETTE : LIGHT_CHART_PALETTE;
}

export function getThresholdBandColor(palette: ChartPalette, index: number): string {
  return palette.thresholdBands[index % palette.thresholdBands.length] ?? palette.thresholdBands[0] ?? '#dcfce7';
}
