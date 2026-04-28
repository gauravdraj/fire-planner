import { useMemo } from 'react';

import { computeYearsFundedFromRetirement } from '@/core/metrics';
import { generateLtcgHarvestPlan, type LtcgHarvestYearResult } from '@/core/planners/ltcgHarvester';
import type { Scenario, WithdrawalPlan, YearBreakdown } from '@/core/projection';
import { toReal } from '@/lib/realDollars';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

import { PlannerCard } from './PlannerCard';
import { defaultLtcgHarvesterPlannerRange, LTCG_HARVESTER_TARGET_ID } from './planners/LtcgHarvesterUI';

type PlannerCardLtcgHarvesterProps = Readonly<{
  onActivateTarget?: () => void;
}>;

type LtcgCardSummary = Readonly<{
  alreadyApplied: boolean;
  actionableYear: LtcgHarvestYearResult | null;
  detail: string;
  fundingLine: string;
  headline: string;
  noActionText: string;
  settingsLine: string;
}>;

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

const CENT = 0.01;

export function PlannerCardLtcgHarvester({ onActivateTarget }: PlannerCardLtcgHarvesterProps = {}) {
  const scenario = useScenarioStore((state) => state.scenario);
  const plan = useScenarioStore((state) => state.plan);
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const retirementYear = useScenarioStore((state) => state.formValues.retirementYear);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const setAdvancedDisclosed = useUiStore((state) => state.setAdvancedDisclosed);
  const summary = useMemo(
    () =>
      buildLtcgCardSummary({
        displayUnit,
        plan,
        projectionResults,
        retirementYear,
        scenario,
      }),
    [displayUnit, plan, projectionResults, retirementYear, scenario],
  );

  function openLtcgHarvester() {
    setAdvancedDisclosed(true);
    onActivateTarget?.();
    scrollToLtcgHarvester();
  }

  const showCta = summary.actionableYear !== null && !summary.alreadyApplied;

  return (
    <PlannerCard
      detail={summary.actionableYear === null ? summary.noActionText : summary.detail}
      headline={summary.headline}
      question="Can you harvest taxable gains at 0%?"
      statusLine={
        <>
          <span>{summary.settingsLine}</span>
          <span className="block">{summary.fundingLine}</span>
        </>
      }
      {...(showCta ? { ctaLabel: 'Open gain harvester', onCta: openLtcgHarvester } : {})}
    />
  );
}

function buildLtcgCardSummary({
  displayUnit,
  plan,
  projectionResults,
  retirementYear,
  scenario,
}: {
  displayUnit: DisplayUnit;
  plan: WithdrawalPlan;
  projectionResults: readonly YearBreakdown[];
  retirementYear: number;
  scenario: Scenario;
}): LtcgCardSummary {
  const range = defaultLtcgHarvesterPlannerRange(scenario, plan);
  const result = generateLtcgHarvestPlan({
    basePlan: plan,
    endYear: range.endYear,
    scenario,
    startYear: range.startYear,
  });
  const actionableYear = result.years.find((year) => year.harvestAmount > CENT) ?? null;
  const funding = computeYearsFundedFromRetirement(projectionResults, retirementYear);
  const fundingLine =
    funding.depletedYear === null
      ? `Plan is funded through ${funding.fundedThroughYear ?? plan.endYear}.`
      : `Plan depletes in ${funding.depletedYear}; review spending runway before harvesting gains.`;
  const settingsLine = 'Default: fill the 0% LTCG bracket; ACA and IRMAA guards are off.';

  if (actionableYear === null) {
    return {
      actionableYear,
      alreadyApplied: false,
      detail: '',
      fundingLine,
      headline: 'No harvest suggested',
      noActionText: 'No 0% LTCG headroom found with embedded brokerage gains.',
      settingsLine,
    };
  }

  const alreadyApplied = harvestsMatchInRange(plan, result.plan, range);

  return {
    actionableYear,
    alreadyApplied,
    detail: alreadyApplied
      ? 'Default 0% LTCG harvests already match this plan.'
      : `Suggested ${actionableYear.year} brokerage harvest.`,
    fundingLine,
    headline: formatDisplayCurrency(actionableYear.harvestAmount, actionableYear.year, scenario, displayUnit),
    noActionText: '',
    settingsLine,
  };
}

function harvestsMatchInRange(
  currentPlan: WithdrawalPlan,
  suggestedPlan: WithdrawalPlan,
  range: { startYear: number; endYear: number },
): boolean {
  const currentHarvests = harvestsInRange(currentPlan, range);
  const suggestedHarvests = harvestsInRange(suggestedPlan, range);

  if (currentHarvests.length !== suggestedHarvests.length || suggestedHarvests.length === 0) {
    return false;
  }

  return suggestedHarvests.every((suggested, index) => {
    const current = currentHarvests[index];

    return current !== undefined && current.year === suggested.year && Math.abs(current.amount - suggested.amount) <= CENT;
  });
}

function harvestsInRange(plan: WithdrawalPlan, range: { startYear: number; endYear: number }) {
  return (plan.brokerageHarvests ?? [])
    .filter((harvest) => harvest.year >= range.startYear && harvest.year <= range.endYear && harvest.amount > CENT)
    .sort((left, right) => left.year - right.year);
}

function formatDisplayCurrency(amount: number, year: number, scenario: Scenario, displayUnit: DisplayUnit): string {
  const displayAmount = displayUnit === 'real' ? toReal(amount, year, scenario.startYear, scenario.inflationRate) : amount;

  return DOLLAR_FORMATTER.format(displayAmount);
}

function scrollToLtcgHarvester() {
  const scroll = () => {
    document.getElementById(LTCG_HARVESTER_TARGET_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(scroll);
  } else {
    window.setTimeout(scroll, 0);
  }
}
