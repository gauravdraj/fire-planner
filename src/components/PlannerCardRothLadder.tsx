import { useMemo } from 'react';

import { computeYearsFundedFromRetirement } from '@/core/metrics';
import { generateRothLadderPlan, type RothLadderConstraint, type RothLadderYearResult } from '@/core/planners/rothLadderTargeter';
import type { Scenario, WithdrawalPlan, YearBreakdown } from '@/core/projection';
import { toReal } from '@/lib/realDollars';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

import { PlannerCard } from './PlannerCard';
import {
  buildDefaultRothLadderConstraint,
  defaultRothLadderPlannerRange,
  ROTH_LADDER_TARGET_ID,
} from './planners/RothLadderUI';

type PlannerCardRothLadderProps = Readonly<{
  onActivateTarget?: () => void;
}>;

type RothCardSummary = Readonly<{
  actionableYear: RothLadderYearResult | null;
  bindingLine: string;
  fundingLine: string;
  headline: string;
  noActionText: string;
}>;

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  style: 'percent',
});

export function PlannerCardRothLadder({ onActivateTarget }: PlannerCardRothLadderProps = {}) {
  const scenario = useScenarioStore((state) => state.scenario);
  const plan = useScenarioStore((state) => state.plan);
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const retirementYear = useScenarioStore((state) => state.formValues.retirementYear);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const setAdvancedDisclosed = useUiStore((state) => state.setAdvancedDisclosed);
  const summary = useMemo(
    () =>
      buildRothCardSummary({
        displayUnit,
        plan,
        projectionResults,
        retirementYear,
        scenario,
      }),
    [displayUnit, plan, projectionResults, retirementYear, scenario],
  );

  function openRothTargeter() {
    setAdvancedDisclosed(true);
    onActivateTarget?.();
    scrollToRothTargeter();
  }

  return (
    <PlannerCard
      detail={summary.actionableYear === null ? summary.noActionText : `Suggested ${summary.actionableYear.year} conversion.`}
      headline={summary.headline}
      question="Could a Roth ladder reduce future IRA taxes?"
      statusLine={
        <>
          <span>{summary.bindingLine}</span>
          <span className="block">{summary.fundingLine}</span>
        </>
      }
      {...(summary.actionableYear === null ? {} : { ctaLabel: 'Open Roth ladder', onCta: openRothTargeter })}
    />
  );
}

function buildRothCardSummary({
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
}): RothCardSummary {
  const constraint = buildDefaultRothLadderConstraint(scenario);
  const range = defaultRothLadderPlannerRange(scenario, plan);
  const result = generateRothLadderPlan({
    basePlan: plan,
    constraint,
    endYear: range.endYear,
    scenario,
    startYear: range.startYear,
  });
  const actionableYear = result.years.find((year) => year.conversionAmount > 0) ?? null;
  const funding = computeYearsFundedFromRetirement(projectionResults, retirementYear);
  const recaptureYear = projectionResults.find((year) => (year.rothConversionRecaptureTax ?? 0) > 0)?.year ?? null;
  const bindingLine = `Limit: ${formatConstraint(constraint)}.`;
  const fundingLine =
    recaptureYear !== null
      ? `Warning: projected Roth withdrawals trigger 5-year conversion recapture tax in ${recaptureYear}.`
      : funding.depletedYear === null
      ? `Plan is funded through ${funding.fundedThroughYear ?? plan.endYear}.`
      : `Plan depletes in ${funding.depletedYear}; review spending runway before applying conversions.`;

  if (actionableYear === null) {
    return {
      actionableYear,
      bindingLine,
      fundingLine,
      headline: 'No conversion suggested',
      noActionText: 'No Roth conversion headroom found under the default limit.',
    };
  }

  return {
    actionableYear,
    bindingLine,
    fundingLine,
    headline: formatDisplayCurrency(actionableYear.conversionAmount, actionableYear.year, scenario, displayUnit),
    noActionText: '',
  };
}

function formatConstraint(constraint: RothLadderConstraint): string {
  switch (constraint.kind) {
    case 'federalBracket':
      return `stay within the ${PERCENT_FORMATTER.format(constraint.bracketRate)} federal bracket`;
    case 'irmaaTier':
      return `stay within IRMAA tier ${constraint.maxTier}`;
    case 'acaFplPercentage':
      return `stay under ${constraint.maxFplPercent.toLocaleString('en-US')}x FPL`;
    case 'ltcgBracket':
      return `stay within the ${PERCENT_FORMATTER.format(constraint.bracketRate)} LTCG bracket`;
  }
}

function formatDisplayCurrency(amount: number, year: number, scenario: Scenario, displayUnit: DisplayUnit): string {
  const displayAmount = displayUnit === 'real' ? toReal(amount, year, scenario.startYear, scenario.inflationRate) : amount;

  return DOLLAR_FORMATTER.format(displayAmount);
}

function scrollToRothTargeter() {
  const scroll = () => {
    document.getElementById(ROTH_LADDER_TARGET_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(scroll);
  } else {
    window.setTimeout(scroll, 0);
  }
}
