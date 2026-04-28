import { useEffect, useState } from 'react';

import {
  selectBridgeWindow,
  summarizeProjectionRunChanges,
  type YearChangeSummary,
  type ProjectionMetricFormValues,
} from '@/core/metrics';
import type { YearBreakdown } from '@/core/projection';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore, type ProjectionRunSnapshot } from '@/store/uiStore';

type ActiveCallout = Readonly<{
  changes: readonly YearChangeSummary[];
  targetYear: number;
}>;

const AUTO_DISMISS_MS = 6_000;

export function WhyChangedCallout() {
  const formValues = useScenarioStore((state) => state.formValues);
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const trackProjectionRunSnapshot = useUiStore((state) => state.trackProjectionRunSnapshot);
  const [activeCallout, setActiveCallout] = useState<ActiveCallout | null>(null);

  useEffect(() => {
    const currentSnapshot: ProjectionRunSnapshot = {
      formValues,
      projectionResults,
      scenario,
    };
    const previousSnapshot = useUiStore.getState().lastProjectionRunSnapshot;

    if (previousSnapshot === null) {
      trackProjectionRunSnapshot(currentSnapshot);
      setActiveCallout(null);
      return;
    }

    if (
      previousSnapshot.formValues === formValues &&
      previousSnapshot.projectionResults === projectionResults &&
      previousSnapshot.scenario === scenario
    ) {
      return;
    }

    const targetYear = selectComparisonYear(formValues, projectionResults);
    const changes =
      targetYear === null
        ? []
        : summarizeProjectionRunChanges({
            currentFormValues: formValues,
            currentProjectionResults: projectionResults,
            currentScenario: scenario,
            previousFormValues: previousSnapshot.formValues,
            previousProjectionResults: previousSnapshot.projectionResults,
            previousScenario: previousSnapshot.scenario,
            targetYear,
          }).slice(0, 3);

    trackProjectionRunSnapshot(currentSnapshot);
    setActiveCallout(targetYear === null || changes.length === 0 ? null : { changes, targetYear });
  }, [formValues, projectionResults, scenario, trackProjectionRunSnapshot]);

  useEffect(() => {
    if (activeCallout === null) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setActiveCallout(null);
    }, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [activeCallout]);

  if (activeCallout === null) {
    return null;
  }

  return (
    <aside
      aria-labelledby="why-changed-heading"
      className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-sm shadow-amber-950/5 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100 dark:shadow-none"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100" id="why-changed-heading">
            Why this changed
          </h2>
          <p className="mt-1 text-amber-900 dark:text-amber-200">
            Compared with the previous projection for {activeCallout.targetYear}.
          </p>
        </div>
        <button
          className="rounded-lg border border-amber-300 bg-white/50 px-2 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 motion-reduce:transition-none dark:border-amber-400/40 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/60 dark:focus-visible:outline-amber-300"
          onClick={() => setActiveCallout(null)}
          type="button"
        >
          Dismiss
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {activeCallout.changes.map((change) => (
          <li className="rounded-lg bg-white/45 px-3 py-2 dark:bg-amber-950/35" key={change.kind}>
            <span className="font-semibold">{change.label}:</span> <span className="tabular-nums">{change.detail}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function selectComparisonYear(
  formValues: ProjectionMetricFormValues,
  projectionResults: readonly YearBreakdown[],
): number | null {
  if (projectionResults.length === 0) {
    return null;
  }

  const retirementYear = projectionResults.find((breakdown) => breakdown.year === formValues.retirementYear);
  if (retirementYear !== undefined) {
    return retirementYear.year;
  }

  const firstBridgeYear = selectBridgeWindow(formValues, projectionResults).years[0];
  if (firstBridgeYear !== undefined) {
    return firstBridgeYear.year;
  }

  return projectionResults.reduce((nearest, breakdown) =>
    Math.abs(breakdown.year - formValues.retirementYear) < Math.abs(nearest.year - formValues.retirementYear)
      ? breakdown
      : nearest,
  ).year;
}
