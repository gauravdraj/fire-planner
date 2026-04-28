import { useState } from 'react';

import { AdvancedView } from '@/components/advanced/AdvancedView';
import type { AdvancedTab } from '@/components/advanced/AdvancedView';
import { BalancesChart } from '@/components/BalancesChart';
import { BasicForm } from '@/components/BasicForm';
import { MagiChart } from '@/components/charts/MagiChart';
import { LiveStatsStrip } from '@/components/LiveStatsStrip';
import { PlannerCardLtcgHarvester } from '@/components/PlannerCardLtcgHarvester';
import { PlannerCardRothLadder } from '@/components/PlannerCardRothLadder';
import { PlanVerdict } from '@/components/PlanVerdict';
import { SeventyTwoTCalc } from '@/components/SeventyTwoTCalc';
import { StarterTemplateChooser } from '@/components/StarterTemplateChooser';
import { TaxBreakdownChart } from '@/components/charts/TaxBreakdownChart';
import { WhyChangedCallout } from '@/components/WhyChangedCallout';
import { YearByYearTable } from '@/components/YearByYearTable';
import { useUiStore } from '@/store/uiStore';

type ScenarioIdPair = readonly [string, string];

type BasicPlannerPageProps = {
  onCompare?: ((scenarioIds: ScenarioIdPair) => void) | undefined;
};

export function BasicPlannerPage({ onCompare }: BasicPlannerPageProps = {}) {
  const layout = useUiStore((state) => state.layout);

  return layout === 'verdict' ? <VerdictPlannerPage onCompare={onCompare} /> : <ClassicPlannerPage />;
}

function ClassicPlannerPage() {
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

function VerdictPlannerPage({ onCompare }: BasicPlannerPageProps) {
  const [advancedTab, setAdvancedTab] = useState<AdvancedTab>('custom-law');

  return (
    <section
      aria-labelledby="basic-planner-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none sm:p-6"
    >
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Plan answer</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50" id="basic-planner-heading">
          Plan dashboard
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Start with the verdict, then adjust live inputs. Detailed projections and tools stay below for math review.
        </p>
      </div>

      <section
        aria-label="Plan answer"
        className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/35 dark:shadow-none lg:grid-cols-[minmax(0,0.85fr)_minmax(22rem,1fr)]"
      >
        <PlanVerdict />
        <BalancesChart variant="compact" />
      </section>

      <section
        aria-labelledby="what-if-heading"
        className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/35 dark:shadow-none sm:p-5"
      >
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Plan moves
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50" id="what-if-heading">
            What can you change?
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            These cards preview existing planner tools without changing the projection until you apply them.
          </p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <PlannerCardRothLadder onActivateTarget={() => setAdvancedTab('planner-controls')} />
          <PlannerCardLtcgHarvester onActivateTarget={() => setAdvancedTab('planner-controls')} />
        </div>
      </section>

      <section
        aria-labelledby="adjust-your-plan-heading"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none sm:p-5"
        id="adjust-your-plan"
      >
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Inputs
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50" id="adjust-your-plan-heading">
            Adjust your plan
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            These basic controls update the projection automatically after valid edits.
          </p>
        </div>
        <BasicForm layout="verdict" />
      </section>

      <ProjectionDetailsDisclosure activeTab={advancedTab} onActiveTabChange={setAdvancedTab} onCompare={onCompare} />
      <SecondaryToolsDisclosure />
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

type ProjectionDetailsDisclosureProps = BasicPlannerPageProps & {
  activeTab: AdvancedTab;
  onActiveTabChange: (tab: AdvancedTab) => void;
};

function ProjectionDetailsDisclosure({ activeTab, onActiveTabChange, onCompare }: ProjectionDetailsDisclosureProps) {
  const advancedDisclosed = useUiStore((state) => state.advancedDisclosed);
  const setAdvancedDisclosed = useUiStore((state) => state.setAdvancedDisclosed);

  return (
    <details
      className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/35 dark:shadow-none sm:p-5"
      onToggle={(event) => setAdvancedDisclosed(event.currentTarget.open)}
      open={advancedDisclosed}
    >
      <summary className="cursor-pointer text-lg font-semibold text-slate-950 marker:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 dark:text-slate-50 dark:marker:text-slate-400 dark:focus-visible:outline-indigo-400">
        Show the detailed math
      </summary>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
        Live metrics, change notes, advanced controls, year table, MAGI thresholds, and tax breakdowns remain available.
      </p>
      <LiveStatsStrip />
      <WhyChangedCallout />
      <YearByYearTable />
      <MagiChart />
      <TaxBreakdownChart />
      <div className="mt-6">
        <AdvancedView
          activeTab={activeTab}
          embedded
          onActiveTabChange={onActiveTabChange}
          {...(onCompare === undefined ? {} : { onCompare })}
        />
      </div>
    </details>
  );
}

function SecondaryToolsDisclosure() {
  return (
    <details className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/35 dark:shadow-none sm:p-5">
      <summary className="cursor-pointer text-lg font-semibold text-slate-950 marker:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 dark:text-slate-50 dark:marker:text-slate-400 dark:focus-visible:outline-indigo-400">
        Show starter tools
      </summary>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
        Starter scenarios and the 72(t) calculator stay here, away from the main plan answer.
      </p>
      <StarterTemplateChooser />
      <section
        aria-labelledby="seventy-two-t-heading"
        className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/50 dark:shadow-none"
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
    </details>
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
