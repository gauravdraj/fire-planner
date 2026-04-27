import { useState } from 'react';

import { CustomLawEditor } from '@/components/advanced/CustomLawEditor';
import { ManualWithdrawalTable } from '@/components/advanced/ManualWithdrawalTable';
import { BalancesChart } from '@/components/BalancesChart';
import { MagiChart } from '@/components/charts/MagiChart';
import { TaxBreakdownChart } from '@/components/charts/TaxBreakdownChart';
import { LtcgHarvesterUI } from '@/components/planners/LtcgHarvesterUI';
import { RothLadderUI } from '@/components/planners/RothLadderUI';
import { ScenarioManager } from '@/components/scenarios/ScenarioManager';
import { YearByYearTable } from '@/components/YearByYearTable';
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

  return (
    <section aria-labelledby="advanced-view-heading" className="rounded-lg border border-slate-200 p-5">
      <div>
        <p className="text-sm font-medium text-indigo-700">Gate 4 advanced controls</p>
        <h2 className="mt-1 text-xl font-semibold" id="advanced-view-heading">
          Advanced planner
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Edit custom law assumptions, inspect manual plan values, and generate planner actions.
        </p>
      </div>

      <div aria-label="Advanced planner tabs" className="mt-5 flex flex-wrap gap-2" role="tablist">
        {TABS.map((tab) => (
          <button
            aria-controls={`${tab.id}-panel`}
            aria-selected={activeTab === tab.id}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              activeTab === tab.id
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
            id={`${tab.id}-tab`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {activeTab === 'custom-law' ? (
          <div aria-labelledby="custom-law-tab" id="custom-law-panel" role="tabpanel">
            <CustomLawEditor />
          </div>
        ) : null}
        {activeTab === 'manual-plan' ? (
          <div aria-labelledby="manual-plan-tab" id="manual-plan-panel" role="tabpanel">
            <ManualWithdrawalTable />
          </div>
        ) : null}
        {activeTab === 'planner-controls' ? (
          <div aria-labelledby="planner-controls-tab" className="space-y-5" id="planner-controls-panel" role="tabpanel">
            <RothLadderUI />
            <LtcgHarvesterUI />
          </div>
        ) : null}
        {activeTab === 'planning-charts' ? (
          <div aria-labelledby="planning-charts-tab" className="space-y-5" id="planning-charts-panel" role="tabpanel">
            <YearByYearTable />
            <BalancesChart />
            <MagiChart />
            <TaxBreakdownChart />
          </div>
        ) : null}
        {activeTab === 'scenarios' ? (
          <div aria-labelledby="scenarios-tab" id="scenarios-panel" role="tabpanel">
            <ScenarioManager {...(onCompare === undefined ? {} : { onCompare })} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
