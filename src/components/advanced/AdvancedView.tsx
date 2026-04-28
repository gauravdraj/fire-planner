import { useState, type KeyboardEvent } from 'react';

import { CustomLawEditor } from '@/components/advanced/CustomLawEditor';
import { ManualWithdrawalTable } from '@/components/advanced/ManualWithdrawalTable';
import { BalancesChart } from '@/components/BalancesChart';
import { MagiChart } from '@/components/charts/MagiChart';
import { TaxBreakdownChart } from '@/components/charts/TaxBreakdownChart';
import { LtcgHarvesterUI } from '@/components/planners/LtcgHarvesterUI';
import { RothLadderUI } from '@/components/planners/RothLadderUI';
import { ScenarioManager } from '@/components/scenarios/ScenarioManager';
import { YearByYearTable } from '@/components/YearByYearTable';
import { classNames } from '@/components/ui/controlStyles';
import { useUiStore } from '@/store/uiStore';

type ScenarioIdPair = readonly [string, string];
type AdvancedTab = 'custom-law' | 'manual-plan' | 'planner-controls' | 'planning-charts' | 'scenarios';
type AdvancedViewProps = {
  onCompare?: (scenarioIds: ScenarioIdPair) => void;
};

const TABS: ReadonlyArray<{ id: AdvancedTab; label: string }> = [
  { id: 'custom-law', label: 'Custom law' },
  { id: 'manual-plan', label: 'Manual plan' },
  { id: 'planner-controls', label: 'Planner controls' },
  { id: 'planning-charts', label: 'Planning charts' },
  { id: 'scenarios', label: 'Scenarios' },
];

export function AdvancedView({ onCompare }: AdvancedViewProps = {}) {
  const mode = useUiStore((state) => state.mode);
  const [activeTab, setActiveTab] = useState<AdvancedTab>('custom-law');

  if (mode !== 'advanced') {
    return null;
  }

  function focusTab(tabId: AdvancedTab) {
    setActiveTab(tabId);
    document.getElementById(`${tabId}-tab`)?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: AdvancedTab) {
    const currentIndex = TABS.findIndex((tab) => tab.id === currentTab);
    const lastIndex = TABS.length - 1;

    if (currentIndex === -1) {
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const nextTab = TABS[currentIndex === lastIndex ? 0 : currentIndex + 1];
      if (nextTab !== undefined) {
        focusTab(nextTab.id);
      }
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextTab = TABS[currentIndex === 0 ? lastIndex : currentIndex - 1];
      if (nextTab !== undefined) {
        focusTab(nextTab.id);
      }
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      const firstTab = TABS[0];
      if (firstTab !== undefined) {
        focusTab(firstTab.id);
      }
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      const lastTab = TABS[lastIndex];
      if (lastTab !== undefined) {
        focusTab(lastTab.id);
      }
    }
  }

  return (
    <section
      aria-labelledby="advanced-view-heading"
      className="min-w-0 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none"
    >
      <div>
        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Gate 4 advanced controls</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50" id="advanced-view-heading">
          Advanced planner
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Edit custom law assumptions, inspect manual plan values, and generate planner actions.
        </p>
      </div>

      <div
        aria-label="Advanced planner tabs"
        className="mt-5 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900/70"
        role="tablist"
      >
        {TABS.map((tab) => (
          <button
            aria-controls={`${tab.id}-panel`}
            aria-selected={activeTab === tab.id}
            className={classNames(
              'rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:focus-visible:outline-indigo-400',
              activeTab === tab.id
                ? 'border-slate-950 bg-slate-950 text-white shadow-sm shadow-slate-900/10 dark:border-indigo-400 dark:bg-indigo-400 dark:text-slate-950 dark:shadow-none'
                : 'border-transparent text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-950 dark:hover:text-slate-50',
            )}
            id={`${tab.id}-tab`}
            key={tab.id}
            onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            tabIndex={activeTab === tab.id ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {activeTab === 'custom-law' ? (
          <div className={tabPanelClassName} aria-labelledby="custom-law-tab" id="custom-law-panel" role="tabpanel" tabIndex={0}>
            <CustomLawEditor />
          </div>
        ) : null}
        {activeTab === 'manual-plan' ? (
          <div className={tabPanelClassName} aria-labelledby="manual-plan-tab" id="manual-plan-panel" role="tabpanel" tabIndex={0}>
            <ManualWithdrawalTable />
          </div>
        ) : null}
        {activeTab === 'planner-controls' ? (
          <div
            aria-labelledby="planner-controls-tab"
            className={classNames(tabPanelClassName, 'space-y-5')}
            id="planner-controls-panel"
            role="tabpanel"
            tabIndex={0}
          >
            <RothLadderUI />
            <LtcgHarvesterUI />
          </div>
        ) : null}
        {activeTab === 'planning-charts' ? (
          <div
            aria-labelledby="planning-charts-tab"
            className={classNames(tabPanelClassName, 'space-y-5')}
            id="planning-charts-panel"
            role="tabpanel"
            tabIndex={0}
          >
            <YearByYearTable />
            <BalancesChart />
            <MagiChart />
            <TaxBreakdownChart />
          </div>
        ) : null}
        {activeTab === 'scenarios' ? (
          <div className={tabPanelClassName} aria-labelledby="scenarios-tab" id="scenarios-panel" role="tabpanel" tabIndex={0}>
            <ScenarioManager {...(onCompare === undefined ? {} : { onCompare })} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

const tabPanelClassName =
  'min-w-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400';
