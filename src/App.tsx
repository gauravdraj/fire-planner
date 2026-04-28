import { useState } from 'react';

import { AdvancedView } from '@/components/advanced/AdvancedView';
import { BasicPlannerPage } from '@/components/BasicPlannerPage';
import { CompareView } from '@/components/compare/CompareView';
import { Disclaimer } from '@/components/Disclaimer';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { MethodologyPage } from '@/components/MethodologyPage';
import { StalenessGate } from '@/components/StalenessGate';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

export const CUSTOM_LAW_BANNER_TEXT =
  'Custom-law scenario active — outputs reflect your edits, not current US tax law.';

type ScenarioIdPair = readonly [string, string];

export function App() {
  const mode = useUiStore((state) => state.mode);
  const setMode = useUiStore((state) => state.setMode);
  const customLawActive = useScenarioStore((state) => state.customLawActive);
  const [compareScenarioIds, setCompareScenarioIds] = useState<ScenarioIdPair | undefined>(undefined);

  function launchCompare(scenarioIds: ScenarioIdPair) {
    setCompareScenarioIds(scenarioIds);
    setMode('compare');
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <Disclaimer />
      <StalenessGate />
      <Header />
      {customLawActive ? <CustomLawBanner /> : null}
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {mode === 'methodology' ? (
          <MethodologyPage />
        ) : mode === 'compare' ? (
          <CompareView {...(compareScenarioIds === undefined ? {} : { initialScenarioIds: compareScenarioIds })} />
        ) : mode === 'advanced' ? (
          <AdvancedView onCompare={launchCompare} />
        ) : (
          <BasicPlannerPage />
        )}
      </main>
      <Footer />
    </div>
  );
}

function CustomLawBanner() {
  return (
    <div className="border-y border-amber-300 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-950" role="status">
      <div className="mx-auto max-w-5xl">{CUSTOM_LAW_BANNER_TEXT}</div>
    </div>
  );
}
