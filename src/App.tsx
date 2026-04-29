import { useState } from 'react';

import { AdvancedView } from '@/components/advanced/AdvancedView';
import { BasicPlannerPage } from '@/components/BasicPlannerPage';
import { CompareView } from '@/components/compare/CompareView';
import { Disclaimer } from '@/components/Disclaimer';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { MethodologyPage } from '@/components/MethodologyPage';
import { StalenessGate } from '@/components/StalenessGate';
import { useResolvedTheme } from '@/lib/theme';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

export const CUSTOM_LAW_BANNER_TEXT =
  'Custom-law scenario active — outputs reflect your edits, not current US tax law.';

type ScenarioIdPair = readonly [string, string];

export function App() {
  const advancedDisclosed = useUiStore((state) => state.advancedDisclosed);
  const layout = useUiStore((state) => state.layout);
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);
  const themePreference = useUiStore((state) => state.themePreference);
  const customLawActive = useScenarioStore((state) => state.customLawActive);
  const [compareScenarioIds, setCompareScenarioIds] = useState<ScenarioIdPair | undefined>(undefined);
  useResolvedTheme(themePreference);

  function launchCompare(scenarioIds: ScenarioIdPair) {
    setCompareScenarioIds(scenarioIds);
    setView('compare');
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-50 text-slate-950 antialiased dark:bg-slate-950 dark:text-slate-100">
      <Disclaimer />
      <StalenessGate />
      <Header />
      {customLawActive ? <CustomLawBanner /> : null}
      <main className="mx-auto w-full max-w-5xl min-w-0 px-3 py-6 sm:px-4 sm:py-8 lg:max-w-6xl lg:py-10 xl:max-w-7xl 2xl:max-w-screen-2xl">
        {view === 'methodology' ? (
          <MethodologyPage />
        ) : view === 'compare' ? (
          <CompareView {...(compareScenarioIds === undefined ? {} : { initialScenarioIds: compareScenarioIds })} />
        ) : layout === 'classic' && advancedDisclosed ? (
          <AdvancedView onCompare={launchCompare} />
        ) : (
          <BasicPlannerPage onCompare={launchCompare} />
        )}
      </main>
      <Footer />
    </div>
  );
}

function CustomLawBanner() {
  return (
    <div
      className="border-y border-amber-300/80 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 shadow-sm shadow-amber-900/5 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100 dark:shadow-none"
      role="status"
    >
      <div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl">{CUSTOM_LAW_BANNER_TEXT}</div>
    </div>
  );
}
