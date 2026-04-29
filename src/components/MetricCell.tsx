import { computeFplBand, computeWithdrawalRateBand, type FplBand, type WithdrawalRateBand } from '@/core/metrics';
import { useChangePulse } from '@/lib/useChangePulse';

export type MetricCellBandType = 'fpl' | 'wdRate' | 'cashflow' | 'none';

export type MetricCellProps = Readonly<{
  displayText: string;
  rawNumeric: number | null;
  bandType: MetricCellBandType;
  metricBand?: FplBand | WithdrawalRateBand;
  pulseKey?: string | number;
  label?: string;
  className?: string;
}>;

const FPL_BAND_CLASSES: Record<FplBand, string> = {
  'below-aca': 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
  'aca-low': 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  'aca-mid': 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  'aca-high': 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
  'above-cliff': 'bg-rose-200 text-rose-950 font-bold dark:bg-rose-900/70 dark:text-rose-100',
};

const WITHDRAWAL_RATE_BAND_CLASSES: Record<WithdrawalRateBand, string> = {
  safe: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200',
  caution: 'bg-amber-100 text-amber-900 dark:bg-amber-950/55 dark:text-amber-200',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-950/55 dark:text-rose-200',
  catastrophic: 'bg-rose-200 text-rose-950 font-bold dark:bg-rose-900/70 dark:text-rose-100',
  'plan-end': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
};

export function MetricCell({ displayText, rawNumeric, bandType, metricBand, pulseKey, label, className }: MetricCellProps) {
  const isPulsing = useChangePulse(pulseKey ?? 'metric-cell-no-pulse');
  const bandClassName = metricBandClassName(rawNumeric, bandType, metricBand);
  const visibleBandClassName = isPulsing
    ? classNames(withoutBackgroundClass(bandClassName), 'bg-yellow-100 dark:bg-yellow-900/40')
    : bandClassName;

  return (
    <span
      aria-label={label === undefined ? undefined : `${label}: ${displayText}`}
      className={classNames('tabular-nums transition-colors duration-700 motion-reduce:transition-none', visibleBandClassName, className)}
    >
      {displayText}
    </span>
  );
}

function metricBandClassName(
  rawNumeric: number | null,
  bandType: MetricCellBandType,
  metricBand: FplBand | WithdrawalRateBand | undefined,
): string {
  if (rawNumeric === null) {
    return '';
  }

  switch (bandType) {
    case 'fpl':
      return FPL_BAND_CLASSES[(metricBand as FplBand | undefined) ?? computeFplBand(rawNumeric)];
    case 'wdRate':
      return WITHDRAWAL_RATE_BAND_CLASSES[(metricBand as WithdrawalRateBand | undefined) ?? computeWithdrawalRateBand(rawNumeric)];
    case 'cashflow':
      return rawNumeric < 0 ? 'text-rose-700 font-semibold dark:text-rose-300' : '';
    case 'none':
      return '';
  }
}

function withoutBackgroundClass(className: string): string {
  return className
    .split(' ')
    .filter((value) => value !== '' && !value.startsWith('bg-') && !value.startsWith('dark:bg-'))
    .join(' ');
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
