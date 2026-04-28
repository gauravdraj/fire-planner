import type { AnnualAmount, WithdrawalPlan } from '@/core/projection';
import { classNames, formControlClassName } from '@/components/ui/controlStyles';
import { balanceSweepContract } from '@/lib/exportContracts';
import { useScenarioStore } from '@/store/scenarioStore';

const secondaryButtonClassName =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:focus-visible:outline-indigo-400';

export function ManualWithdrawalTable() {
  const scenario = useScenarioStore((state) => state.scenario);
  const plan = useScenarioStore((state) => state.plan);
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const setPlan = useScenarioStore((state) => state.setPlan);
  const years = buildYearRange(scenario.startYear, plan.endYear);
  const hasProjection = projectionResults.length > 0;
  const canRunBalanceSweep = balanceSweepContract.supported && hasProjection;
  const balanceSweepUnavailableReason = hasProjection
    ? 'Account-specific manual withdrawal overrides are deferred because they would require projection engine contract changes. Annual spending is a spending override, so Balance all years will not write brokerage withdrawals into it.'
    : 'Balance all years needs an active scenario and projection before it can run.';

  function updateSpending(year: number, value: string) {
    setPlan({
      ...plan,
      annualSpending: setAnnualAmount(plan.annualSpending, year, parseMoneyInput(value), true),
    });
  }

  function updateRothConversion(year: number, value: string) {
    setPlan(withOptionalAnnualAmounts(plan, 'rothConversions', year, parseMoneyInput(value)));
  }

  function updateBrokerageHarvest(year: number, value: string) {
    setPlan(withOptionalAnnualAmounts(plan, 'brokerageHarvests', year, parseMoneyInput(value)));
  }

  function clearYear(year: number) {
    setPlan({
      ...withoutOptionalAnnualAmount(withoutOptionalAnnualAmount(plan, 'rothConversions', year), 'brokerageHarvests', year),
      annualSpending: removeAnnualAmount(plan.annualSpending, year),
    });
  }

  function clearPlannerActions() {
    const { brokerageHarvests: _ignoredHarvests, rothConversions: _ignoredConversions, ...planWithoutActions } = plan;

    setPlan(planWithoutActions);
  }

  return (
    <section aria-labelledby="manual-plan-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50" id="manual-plan-heading">
            Manual withdrawal planning
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Edit annual spending overrides, Roth conversions, and brokerage LTCG harvest targets used by the projection
            engine.
          </p>
        </div>
        <button
          className={classNames(secondaryButtonClassName, 'self-start')}
          onClick={clearPlannerActions}
          type="button"
        >
          Clear planner actions
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex min-w-[42rem] flex-col gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              aria-describedby="balance-all-years-explanation"
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-500 motion-reduce:transition-none dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100 dark:focus-visible:outline-indigo-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
              disabled={!canRunBalanceSweep}
              type="button"
            >
              Balance all years
            </button>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300" id="balance-all-years-explanation">
            {balanceSweepUnavailableReason}
          </p>
        </div>
        <table className="min-w-[42rem] divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2" scope="col">
                Year
              </th>
              <th className="px-3 py-2" scope="col">
                Spending
              </th>
              <th className="px-3 py-2" scope="col">
                Roth conversion
              </th>
              <th className="px-3 py-2" scope="col">
                Brokerage harvest
              </th>
              <th className="px-3 py-2" scope="col">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
            {years.map((year) => (
              <tr className="transition-colors hover:bg-slate-50/80 motion-reduce:transition-none dark:hover:bg-slate-900/50" key={year}>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium tabular-nums text-slate-950 dark:text-slate-50" scope="row">
                  {year}
                </th>
                <td className="px-3 py-2">
                  <MoneyInput
                    ariaLabel={`Spending ${year}`}
                    onChange={(value) => updateSpending(year, value)}
                    value={amountForYear(plan.annualSpending, year)}
                  />
                </td>
                <td className="px-3 py-2">
                  <MoneyInput
                    ariaLabel={`Roth conversion ${year}`}
                    onChange={(value) => updateRothConversion(year, value)}
                    value={amountForYear(plan.rothConversions ?? [], year)}
                  />
                </td>
                <td className="px-3 py-2">
                  <MoneyInput
                    ariaLabel={`Brokerage harvest ${year}`}
                    onChange={(value) => updateBrokerageHarvest(year, value)}
                    value={amountForYear(plan.brokerageHarvests ?? [], year)}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    className={classNames(secondaryButtonClassName, 'px-2 py-1 text-xs')}
                    onClick={() => clearYear(year)}
                    type="button"
                  >
                    Clear {year}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MoneyInput({
  ariaLabel,
  onChange,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  value: number | null;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className={formControlClassName({ className: 'w-36 rounded-md px-2 py-1.5 tabular-nums' })}
      inputMode="decimal"
      min="0"
      onChange={(event) => onChange(event.target.value)}
      placeholder="0"
      step="100"
      type="number"
      value={value === null ? '' : String(value)}
    />
  );
}

function buildYearRange(startYear: number, endYear: number): number[] {
  const years: number[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    years.push(year);
  }

  return years;
}

function amountForYear(entries: readonly AnnualAmount[], year: number): number | null {
  return entries.find((entry) => entry.year === year)?.amount ?? null;
}

function parseMoneyInput(value: string): number | null {
  const trimmed = value.trim().replaceAll(',', '');

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 ? roundToCents(parsed) : null;
}

function withOptionalAnnualAmounts(
  plan: WithdrawalPlan,
  field: 'rothConversions' | 'brokerageHarvests',
  year: number,
  amount: number | null,
): WithdrawalPlan {
  const entries = setAnnualAmount(plan[field] ?? [], year, amount, false);

  if (entries.length === 0) {
    const { [field]: _ignoredField, ...planWithoutField } = plan;

    return planWithoutField;
  }

  return {
    ...plan,
    [field]: entries,
  };
}

function withoutOptionalAnnualAmount(
  plan: WithdrawalPlan,
  field: 'rothConversions' | 'brokerageHarvests',
  year: number,
): WithdrawalPlan {
  return withOptionalAnnualAmounts(plan, field, year, null);
}

function setAnnualAmount(
  entries: readonly AnnualAmount[],
  year: number,
  amount: number | null,
  keepZero: boolean,
): AnnualAmount[] {
  if (amount === null || (!keepZero && amount <= 0)) {
    return removeAnnualAmount(entries, year);
  }

  return [...entries.filter((entry) => entry.year !== year), { year, amount }].sort((left, right) => left.year - right.year);
}

function removeAnnualAmount(entries: readonly AnnualAmount[], year: number): AnnualAmount[] {
  return entries.filter((entry) => entry.year !== year);
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}
