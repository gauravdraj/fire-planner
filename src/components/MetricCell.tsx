import { computeFplBand, computeWithdrawalRateBand, type FplBand, type WithdrawalRateBand } from '@/core/metrics';
import { useChangePulse } from '@/lib/useChangePulse';

export type MetricCellBandType = 'fpl' | 'wdRate' | 'cashflow' | 'none';

export type MetricCellProps = Readonly<{
  displayText: string;
  rawNumeric: number | null;
  bandType: MetricCellBandType;
  pulseKey?: string | number;
  label?: string;
  className?: string;
}>;

const FPL_BAND_CLASSES: Record<FplBand, string> = {
  'below-aca': 'bg-rose-100 text-rose-800',
  'aca-low': 'bg-amber-50 text-amber-800',
  'aca-mid': 'bg-emerald-100 text-emerald-900',
  'aca-high': 'bg-amber-100 text-amber-900',
  'above-cliff': 'bg-rose-300 text-rose-950 font-bold',
};

const WITHDRAWAL_RATE_BAND_CLASSES: Record<WithdrawalRateBand, string> = {
  safe: 'bg-emerald-50 text-emerald-800',
  caution: 'bg-amber-100 text-amber-900',
  danger: 'bg-rose-200 text-rose-900',
  catastrophic: 'bg-rose-400 text-rose-950 font-bold',
};

export function MetricCell({ displayText, rawNumeric, bandType, pulseKey, label, className }: MetricCellProps) {
  const isPulsing = useChangePulse(pulseKey ?? 'metric-cell-no-pulse');
  const bandClassName = metricBandClassName(rawNumeric, bandType);
  const visibleBandClassName = isPulsing ? classNames(withoutBackgroundClass(bandClassName), 'bg-yellow-100') : bandClassName;

  return (
    <span
      aria-label={label === undefined ? undefined : `${label}: ${displayText}`}
      className={classNames('tabular-nums transition-colors duration-700', visibleBandClassName, className)}
    >
      {displayText}
    </span>
  );
}

function metricBandClassName(rawNumeric: number | null, bandType: MetricCellBandType): string {
  if (rawNumeric === null) {
    return '';
  }

  switch (bandType) {
    case 'fpl':
      return FPL_BAND_CLASSES[computeFplBand(rawNumeric)];
    case 'wdRate':
      return WITHDRAWAL_RATE_BAND_CLASSES[computeWithdrawalRateBand(rawNumeric)];
    case 'cashflow':
      return rawNumeric < 0 ? 'text-rose-700 font-semibold' : '';
    case 'none':
      return '';
  }
}

function withoutBackgroundClass(className: string): string {
  return className
    .split(' ')
    .filter((value) => value !== '' && !value.startsWith('bg-'))
    .join(' ');
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
