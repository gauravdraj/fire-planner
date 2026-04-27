import { useMemo } from 'react';

import {
  computeAverageBridgeAcaMagi,
  computeYearDisplayMetrics,
  computeMaxBridgeGrossBucketDrawPercentage,
  computeNetWorthAtRetirement,
  computePlanEndBalance,
  computeTotalBridgeTax,
  computeYearsFundedFromRetirement,
  selectBridgeWindow,
  type ProjectionMetricFormValues,
} from '@/core/metrics';
import type { Scenario, YearBreakdown } from '@/core/projection';
import { liveStatExplanations, type LiveStatMetricId } from '@/lib/columnExplanations';
import { toReal } from '@/lib/realDollars';
import { useChangePulse } from '@/lib/useChangePulse';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

import { InfoTooltip } from './InfoTooltip';
import { MetricCell, type MetricCellBandType } from './MetricCell';

type LiveStat = Readonly<{
  id: LiveStatMetricId;
  label: string;
  explanation: string;
  value: string;
  rawNumeric: number | null;
  bandType: MetricCellBandType;
  pulseValue: string | number;
  detail: string;
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

export function LiveStatsStrip() {
  const formValues = useScenarioStore((state) => state.formValues);
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const stats = useMemo(
    () => buildLiveStats({ displayUnit, formValues, projectionResults, scenario }),
    [displayUnit, formValues, projectionResults, scenario],
  );
  return (
    <section aria-label="Live projection stats" className="sticky top-0 z-10 mt-6 bg-white/90 py-3 backdrop-blur">
      <ul className="grid gap-2 rounded-lg border border-slate-200 bg-white/80 p-3 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map((stat) => (
          <LiveStatCell key={stat.id} stat={stat} />
        ))}
      </ul>
    </section>
  );
}

function LiveStatCell({ stat }: { stat: LiveStat }) {
  const isPulsing = useChangePulse(stat.pulseValue);

  return (
    <li
      className={[
        'relative rounded-md border border-slate-100 px-3 py-2 transition-colors duration-700',
        isPulsing ? 'bg-yellow-100' : 'bg-white',
      ].join(' ')}
      data-testid={`live-stat-${stat.id}`}
    >
      <p className="flex items-center gap-1.5 pr-4 text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">
        <span>{stat.label}</span>
        <InfoTooltip ariaLabel={`About ${stat.label}`}>{stat.explanation}</InfoTooltip>
      </p>
      <p className="mt-1 text-base font-semibold text-slate-950">
        <MetricCell
          bandType={stat.bandType}
          displayText={stat.value}
          rawNumeric={stat.rawNumeric}
          {...(stat.bandType === 'none' ? {} : { className: 'rounded px-1' })}
        />
      </p>
      <p className="mt-1 text-[0.7rem] leading-snug text-slate-500">{stat.detail}</p>
    </li>
  );
}

function buildLiveStats({
  displayUnit,
  formValues,
  projectionResults,
  scenario,
}: {
  displayUnit: DisplayUnit;
  formValues: ProjectionMetricFormValues;
  projectionResults: readonly YearBreakdown[];
  scenario: Scenario;
}): readonly LiveStat[] {
  const retirementNetWorth = computeNetWorthAtRetirement(projectionResults, formValues.retirementYear);
  const planEndBalance = computePlanEndBalance(projectionResults);
  const yearsFunded = computeYearsFundedFromRetirement(projectionResults, formValues.retirementYear);
  const bridgeWindow = selectBridgeWindow(formValues, projectionResults);
  const averageBridgeMagi = computeAverageBridgeAcaMagi(bridgeWindow.years);
  const averageBridgeFplPercentage = computeAverageBridgeFplPercentage(bridgeWindow.years, projectionResults, formValues, scenario);
  const maxBridgeDrawPercentage = computeMaxBridgeGrossBucketDrawPercentage(bridgeWindow.years);
  const totalBridgeTax = computeTotalBridgeTax(bridgeWindow.years);
  const bridgeDetail = formatBridgeDetail(bridgeWindow.startYear, bridgeWindow.endYear);

  return [
    {
      id: 'net-worth-at-retirement',
      label: liveStatExplanations['net-worth-at-retirement'].label,
      explanation: liveStatExplanations['net-worth-at-retirement'].description,
      value: formatBalanceMetric(retirementNetWorth, scenario, displayUnit),
      rawNumeric: retirementNetWorth?.amount ?? null,
      bandType: 'none',
      pulseValue: metricPulseValue(retirementNetWorth),
      detail: retirementNetWorth === null ? 'No retirement row.' : `Opening balance in ${retirementNetWorth.year}.`,
    },
    {
      id: 'plan-end-balance',
      label: liveStatExplanations['plan-end-balance'].label,
      explanation: liveStatExplanations['plan-end-balance'].description,
      value: formatBalanceMetric(planEndBalance, scenario, displayUnit),
      rawNumeric: planEndBalance?.amount ?? null,
      bandType: 'none',
      pulseValue: metricPulseValue(planEndBalance),
      detail: planEndBalance === null ? 'No final row.' : `Closing balance in ${planEndBalance.year}.`,
    },
    {
      id: 'years-funded',
      label: liveStatExplanations['years-funded'].label,
      explanation: liveStatExplanations['years-funded'].description,
      value: formatYears(yearsFunded.count),
      rawNumeric: yearsFunded.count,
      bandType: 'none',
      pulseValue: yearsFunded.count,
      detail:
        yearsFunded.depletedYear === null
          ? `Funded through ${yearsFunded.fundedThroughYear ?? 'plan end'}.`
          : `Depletes in ${yearsFunded.depletedYear}.`,
    },
    {
      id: 'average-bridge-magi',
      label: liveStatExplanations['average-bridge-magi'].label,
      explanation: liveStatExplanations['average-bridge-magi'].description,
      value: formatNullableDollar(
        displayUnit === 'real'
          ? computeAverageDisplayAmount(bridgeWindow.years, scenario, (breakdown) => breakdown.acaMagi)
          : averageBridgeMagi,
      ),
      rawNumeric: averageBridgeFplPercentage,
      bandType: 'fpl',
      pulseValue: nullablePulseValue(averageBridgeMagi),
      detail: bridgeDetail,
    },
    {
      id: 'max-bridge-draw-percentage',
      label: liveStatExplanations['max-bridge-draw-percentage'].label,
      explanation: liveStatExplanations['max-bridge-draw-percentage'].description,
      value: formatNullablePercentage(maxBridgeDrawPercentage),
      rawNumeric: maxBridgeDrawPercentage,
      bandType: 'wdRate',
      pulseValue: nullablePulseValue(maxBridgeDrawPercentage),
      detail: bridgeDetail,
    },
    {
      id: 'total-bridge-tax',
      label: liveStatExplanations['total-bridge-tax'].label,
      explanation: liveStatExplanations['total-bridge-tax'].description,
      value: formatNullableDollar(
        displayUnit === 'real'
          ? computeTotalDisplayAmount(bridgeWindow.years, scenario, (breakdown) => breakdown.totalTax)
          : totalBridgeTax,
      ),
      rawNumeric: totalBridgeTax,
      bandType: 'none',
      pulseValue: nullablePulseValue(totalBridgeTax),
      detail: bridgeDetail,
    },
  ];
}

function formatBalanceMetric(
  metric: ReturnType<typeof computeNetWorthAtRetirement> | ReturnType<typeof computePlanEndBalance>,
  scenario: Scenario,
  displayUnit: DisplayUnit,
): string {
  if (metric === null) {
    return '-';
  }

  return formatNullableDollar(displayAmount(metric.amount, metric.year, scenario, displayUnit));
}

function computeAverageDisplayAmount(
  years: readonly YearBreakdown[],
  scenario: Scenario,
  getAmount: (breakdown: YearBreakdown) => number,
): number | null {
  if (years.length === 0) {
    return null;
  }

  const total = computeTotalDisplayAmount(years, scenario, getAmount);

  return total === null ? null : total / years.length;
}

function computeTotalDisplayAmount(
  years: readonly YearBreakdown[],
  scenario: Scenario,
  getAmount: (breakdown: YearBreakdown) => number,
): number | null {
  if (years.length === 0) {
    return null;
  }

  return years.reduce((total, breakdown) => total + displayAmount(getAmount(breakdown), breakdown.year, scenario, 'real'), 0);
}

function computeAverageBridgeFplPercentage(
  bridgeYears: readonly YearBreakdown[],
  projectionResults: readonly YearBreakdown[],
  formValues: ProjectionMetricFormValues,
  scenario: Scenario,
): number | null {
  const bridgeYearSet = new Set(bridgeYears.map((breakdown) => breakdown.year));
  const fplPercentages = projectionResults
    .map((breakdown, index) =>
      bridgeYearSet.has(breakdown.year)
        ? computeYearDisplayMetrics(breakdown, {
            formValues,
            priorYear: projectionResults[index - 1] ?? null,
            scenario,
          }).fplPercentage
        : null,
    )
    .filter((value): value is number => value !== null);

  if (fplPercentages.length === 0) {
    return null;
  }

  return fplPercentages.reduce((total, value) => total + value, 0) / fplPercentages.length;
}

function displayAmount(amount: number, year: number, scenario: Scenario, displayUnit: DisplayUnit): number {
  return displayUnit === 'real' ? toReal(amount, year, scenario.startYear, scenario.inflationRate) : amount;
}

function formatNullableDollar(amount: number | null): string {
  return amount === null ? '-' : DOLLAR_FORMATTER.format(amount);
}

function metricPulseValue(metric: ReturnType<typeof computeNetWorthAtRetirement> | ReturnType<typeof computePlanEndBalance>): string | number {
  return metric === null ? 'missing' : metric.amount;
}

function nullablePulseValue(value: number | null): string | number {
  return value === null ? 'missing' : value;
}

function formatNullablePercentage(value: number | null): string {
  return value === null ? '-' : PERCENT_FORMATTER.format(value);
}

function formatYears(years: number): string {
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

function formatBridgeDetail(startYear: number, endYear: number): string {
  return startYear === endYear ? `Bridge year ${startYear}.` : `Bridge years ${startYear}-${endYear}.`;
}
