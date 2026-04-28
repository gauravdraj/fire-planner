import { BalancesChart } from '@/components/BalancesChart';
import { BasicForm } from '@/components/BasicForm';
import { MagiChart } from '@/components/charts/MagiChart';
import { LiveStatsStrip } from '@/components/LiveStatsStrip';
import { SeventyTwoTCalc } from '@/components/SeventyTwoTCalc';
import { StarterTemplateChooser } from '@/components/StarterTemplateChooser';
import { TaxBreakdownChart } from '@/components/charts/TaxBreakdownChart';
import { WhyChangedCallout } from '@/components/WhyChangedCallout';
import { YearByYearTable } from '@/components/YearByYearTable';

export function BasicPlannerPage() {
  return (
    <section
      aria-labelledby="basic-planner-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none sm:p-6"
    >
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Live basic scenario</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50" id="basic-planner-heading">
          Basic planner
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Enter the household facts the current engine supports. Valid edits debounce into the projection, so the results
          below stay tied to the form without a separate run step.
        </p>
      </div>
      <div
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] xl:items-start"
        data-testid="basic-workstation-layout"
      >
        <div className="min-w-0" data-testid="basic-form-column">
          <BasicForm />
        </div>
        <BasicResultsRail />
      </div>
      <ProjectionResults />
      <StarterTemplateChooser />
      <section
        aria-labelledby="seventy-two-t-heading"
        className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/50 dark:shadow-none"
      >
        <div className="max-w-3xl">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50" id="seventy-two-t-heading">
            72(t) SEPP IRA size calculator
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Fixed Amortization Method. Independent of your scenario above.
          </p>
        </div>
        <SeventyTwoTCalc />
      </section>
    </section>
  );
}

function BasicResultsRail() {
  return (
    <aside
      aria-labelledby="basic-results-rail-heading"
      className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/35 dark:shadow-none sm:p-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:overscroll-contain"
      data-testid="basic-results-rail"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
        Live summary
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50" id="basic-results-rail-heading">
        Projection snapshot
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
        Headline outcomes and balance shape stay visible beside the form on wide desktop screens.
      </p>
      <LiveStatsStrip variant="rail" />
      <BalancesChart variant="compact" />
    </aside>
  );
}

function ProjectionResults() {
  return (
    <>
      <section
        aria-labelledby="basic-results-heading"
        className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/35 dark:shadow-none sm:p-5"
      >
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Always-on projection
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50" id="basic-results-heading">
            Projection results
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Headline metrics and the year-by-year table update from the current basic inputs. Exports use the same
            visible column contract as the table.
          </p>
        </div>
        <WhyChangedCallout />
        <YearByYearTable />
      </section>
      <MagiChart />
      <TaxBreakdownChart />
    </>
  );
}
