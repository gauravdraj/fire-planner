import { computePlanEndBalance, computeYearsFundedFromRetirement } from '@/core/metrics';
import type { Scenario } from '@/core/projection';
import { toReal } from '@/lib/realDollars';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function PlanVerdict() {
  const formValues = useScenarioStore((state) => state.formValues);
  const plan = useScenarioStore((state) => state.plan);
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const yearsFunded = computeYearsFundedFromRetirement(projectionResults, formValues.retirementYear);
  const planEndBalance = computePlanEndBalance(projectionResults);
  const isSolvent = yearsFunded.depletedYear === null;
  const displayedPlanEndBalance =
    planEndBalance === null ? null : displayBalance(planEndBalance.amount, planEndBalance.year, scenario, displayUnit);
  const planEndBalanceText = displayedPlanEndBalance === null ? '-' : DOLLAR_FORMATTER.format(displayedPlanEndBalance);
  const unitLabel = displayUnit === 'real' ? "today's dollars" : 'nominal dollars';
  const gapYears =
    yearsFunded.depletedYear === null ? 0 : Math.max(0, plan.endYear - yearsFunded.depletedYear);

  return (
    <section
      aria-labelledby="plan-verdict-heading"
      className={`rounded-2xl border p-5 shadow-sm shadow-slate-900/5 dark:shadow-none ${
        isSolvent
          ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-950/30'
          : 'border-amber-200 bg-amber-50/90 dark:border-amber-500/30 dark:bg-amber-950/30'
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          isSolvent ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
        }`}
      >
        Plan verdict
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50" id="plan-verdict-heading">
        {isSolvent
          ? `Your plan is funded through age ${formValues.planEndAge}.`
          : `Your plan is funded through ${yearsFunded.depletedYear ?? 'the current projection'}, leaving a ${gapYears}-year shortfall.`}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
        Balance at plan end: <span className="font-semibold tabular-nums">{planEndBalanceText}</span> in {unitLabel}.
      </p>
      {!isSolvent ? (
        <a
          className="mt-4 inline-flex rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-950/10 transition-colors hover:bg-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 motion-reduce:transition-none dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200 dark:focus-visible:outline-amber-300"
          href="#adjust-your-plan"
        >
          Adjust your plan
        </a>
      ) : null}
    </section>
  );
}

function displayBalance(
  amount: number,
  year: number,
  scenario: Scenario,
  displayUnit: DisplayUnit,
): number {
  return displayUnit === 'real' ? toReal(amount, year, scenario.startYear, scenario.inflationRate) : amount;
}
