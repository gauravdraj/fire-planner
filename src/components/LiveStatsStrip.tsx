import { useEffect, useMemo, useRef, useState } from 'react';

import {
  computeAverageBridgeAcaMagi,
  computeMaxBridgeGrossBucketDrawPercentage,
  computeNetWorthAtRetirement,
  computePlanEndBalance,
  computeTotalBridgeTax,
  computeYearsFundedFromRetirement,
  selectBridgeWindow,
  type ProjectionMetricFormValues,
} from '@/core/metrics';
import type { Scenario, YearBreakdown } from '@/core/projection';
import { toReal } from '@/lib/realDollars';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

type LiveStat = Readonly<{
  id: string;
  label: string;
  value: string;
  detail: string;
}>;

const RECENT_UPDATE_MS = 600;

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
  const valueSnapshot = stats.map((stat) => `${stat.id}:${stat.value}`).join('|');
  const previousValuesRef = useRef<Record<string, string> | null>(null);
  const [recentlyChangedIds, setRecentlyChangedIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const previousValues = previousValuesRef.current;
    const currentValues = Object.fromEntries(stats.map((stat) => [stat.id, stat.value]));

    previousValuesRef.current = currentValues;

    if (previousValues === null) {
      return;
    }

    const changedIds = stats
      .filter((stat) => previousValues[stat.id] !== undefined && previousValues[stat.id] !== stat.value)
      .map((stat) => stat.id);

    if (changedIds.length === 0) {
      return;
    }

    setRecentlyChangedIds(new Set(changedIds));

    const timeoutId = setTimeout(() => {
      setRecentlyChangedIds(new Set());
    }, RECENT_UPDATE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [stats, valueSnapshot]);

  return (
    <section aria-label="Live projection stats" className="sticky top-0 z-10 mt-6 bg-white/90 py-3 backdrop-blur">
      <ul className="grid gap-2 rounded-lg border border-slate-200 bg-white/80 p-3 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map((stat) => (
          <LiveStatCell isRecentlyChanged={recentlyChangedIds.has(stat.id)} key={stat.id} stat={stat} />
        ))}
      </ul>
    </section>
  );
}

function LiveStatCell({ isRecentlyChanged, stat }: { isRecentlyChanged: boolean; stat: LiveStat }) {
  return (
    <li
      className="relative rounded-md border border-slate-100 bg-white px-3 py-2"
      data-recent-update={isRecentlyChanged ? 'true' : undefined}
      data-testid={`live-stat-${stat.id}`}
    >
      <span
        aria-hidden="true"
        className={[
          'absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-400 transition-opacity duration-500',
          isRecentlyChanged ? 'opacity-100 animate-pulse' : 'opacity-0',
        ].join(' ')}
        data-testid={`live-stat-pulse-${stat.id}`}
      />
      <p className="pr-4 text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">{stat.label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-slate-950">{stat.value}</p>
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
  const maxBridgeDrawPercentage = computeMaxBridgeGrossBucketDrawPercentage(bridgeWindow.years);
  const totalBridgeTax = computeTotalBridgeTax(bridgeWindow.years);
  const bridgeDetail = formatBridgeDetail(bridgeWindow.startYear, bridgeWindow.endYear);

  return [
    {
      id: 'net-worth-at-retirement',
      label: 'Net worth at retirement',
      value: formatBalanceMetric(retirementNetWorth, scenario, displayUnit),
      detail: retirementNetWorth === null ? 'No retirement row.' : `Opening balance in ${retirementNetWorth.year}.`,
    },
    {
      id: 'plan-end-balance',
      label: 'Plan-end balance',
      value: formatBalanceMetric(planEndBalance, scenario, displayUnit),
      detail: planEndBalance === null ? 'No final row.' : `Closing balance in ${planEndBalance.year}.`,
    },
    {
      id: 'years-funded',
      label: 'Years funded',
      value: formatYears(yearsFunded.count),
      detail:
        yearsFunded.depletedYear === null
          ? `Funded through ${yearsFunded.fundedThroughYear ?? 'plan end'}.`
          : `Depletes in ${yearsFunded.depletedYear}.`,
    },
    {
      id: 'average-bridge-magi',
      label: 'Average MAGI',
      value: formatNullableDollar(
        displayUnit === 'real'
          ? computeAverageDisplayAmount(bridgeWindow.years, scenario, (breakdown) => breakdown.acaMagi)
          : averageBridgeMagi,
      ),
      detail: bridgeDetail,
    },
    {
      id: 'max-bridge-draw-percentage',
      label: 'Max gross bucket draw',
      value: formatNullablePercentage(maxBridgeDrawPercentage),
      detail: bridgeDetail,
    },
    {
      id: 'total-bridge-tax',
      label: 'Total bridge tax',
      value: formatNullableDollar(
        displayUnit === 'real'
          ? computeTotalDisplayAmount(bridgeWindow.years, scenario, (breakdown) => breakdown.totalTax)
          : totalBridgeTax,
      ),
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

function displayAmount(amount: number, year: number, scenario: Scenario, displayUnit: DisplayUnit): number {
  return displayUnit === 'real' ? toReal(amount, year, scenario.startYear, scenario.inflationRate) : amount;
}

function formatNullableDollar(amount: number | null): string {
  return amount === null ? '-' : DOLLAR_FORMATTER.format(amount);
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
