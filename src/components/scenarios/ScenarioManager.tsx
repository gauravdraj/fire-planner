import { type FormEvent, useEffect, useRef, useState } from 'react';

import { checkboxControlClassName, classNames, formControlClassName } from '@/components/ui/controlStyles';
import { useScenarioStore } from '@/store/scenarioStore';
import { type SavedScenario, useScenariosStore } from '@/store/scenariosStore';

type ScenarioManagerProps = {
  onCompare?: (scenarioIds: readonly [string, string]) => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const primaryButtonClassName =
  'rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 motion-reduce:transition-none dark:bg-indigo-400 dark:text-slate-950 dark:hover:bg-indigo-300 dark:active:bg-indigo-500 dark:focus-visible:outline-indigo-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500';
const secondaryButtonClassName =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:active:bg-slate-800 dark:focus-visible:outline-indigo-400';
const destructiveButtonClassName =
  'rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:border-red-400 hover:bg-red-50 active:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 motion-reduce:transition-none dark:border-red-500/50 dark:bg-slate-950 dark:text-red-200 dark:hover:border-red-400 dark:hover:bg-red-950/40 dark:active:bg-red-950/60 dark:focus-visible:outline-red-400';

export function ScenarioManager({ onCompare }: ScenarioManagerProps) {
  const activeScenario = useScenarioStore((state) => state.scenario);
  const activePlan = useScenarioStore((state) => state.plan);
  const scenarios = useScenariosStore((state) => state.scenarios);
  const save = useScenariosStore((state) => state.save);
  const rename = useScenariosStore((state) => state.rename);
  const duplicate = useScenariosStore((state) => state.duplicate);
  const deleteScenario = useScenariosStore((state) => state.delete);
  const [isOpen, setIsOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [renameValues, setRenameValues] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [status, setStatus] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const scenarioCountLabel = scenarios.length === 1 ? '1 saved scenario' : `${scenarios.length} saved scenarios`;
  const canCompare = selectedIds.length === 2;

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => scenarios.some((scenario) => scenario.id === id)));
  }, [scenarios]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    saveInputRef.current?.focus();
  }, [isOpen]);

  function openManager() {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : triggerRef.current;
    setIsOpen(true);
  }

  function closeManager() {
    setIsOpen(false);
    const focusTarget = previousFocusRef.current ?? triggerRef.current;
    window.setTimeout(() => focusTarget?.focus(), 0);
  }

  function handleSaveAs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = save({
      name: saveName,
      plan: activePlan,
      scenario: activeScenario,
    });

    setSaveName('');
    setStatus(`Saved ${saved.name}.`);
  }

  function handleRename(scenario: SavedScenario) {
    const renamed = rename(scenario.id, renameValues[scenario.id] ?? scenario.name);

    if (renamed !== null) {
      setStatus(`Renamed ${renamed.name}.`);
    }
  }

  function handleDuplicate(scenario: SavedScenario) {
    const duplicated = duplicate(scenario.id);

    if (duplicated !== null) {
      setStatus(`Duplicated ${scenario.name}.`);
    }
  }

  function handleUpdate(scenario: SavedScenario) {
    const updated = save({
      id: scenario.id,
      name: scenario.name,
      plan: activePlan,
      scenario: activeScenario,
    });

    setStatus(`Updated ${updated.name} from the active scenario.`);
  }

  function handleDelete(scenario: SavedScenario) {
    if (deleteScenario(scenario.id)) {
      setStatus(`Deleted ${scenario.name}.`);
    }
  }

  function toggleCompareSelection(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((selectedId) => selectedId !== id);
      }

      return current.length >= 2 ? current : [...current, id];
    });
  }

  function launchCompare() {
    const [firstId, secondId] = selectedIds;

    if (firstId === undefined || secondId === undefined) {
      return;
    }

    onCompare?.([firstId, secondId]);
    setStatus('Comparison launched.');
    closeManager();
  }

  return (
    <section
      aria-labelledby="scenario-manager-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-950/40 dark:text-indigo-200">
              Local scenarios
            </p>
            <p className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              {scenarioCountLabel}
            </p>
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-100" id="scenario-manager-heading">
            Scenario manager
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Save local named scenarios, duplicate alternatives, and launch a two-scenario comparison.
          </p>
        </div>
        <button
          className={classNames(primaryButtonClassName, 'w-full justify-center sm:w-auto')}
          onClick={openManager}
          ref={triggerRef}
          type="button"
        >
          Manage scenarios
        </button>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
        <span className="font-semibold text-slate-800 dark:text-slate-200">Browser-local only.</span> Named scenario
        IDs stay in `fire-planner.scenarios.v1`; share links and active-scenario exports use the scenario inputs, not saved
        scenario IDs.
      </div>
      {status.length > 0 ? (
        <p
          className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          role="status"
        >
          {status}
        </p>
      ) : null}

      {isOpen ? (
        <div
          aria-labelledby="scenario-manager-dialog-heading"
          aria-modal="true"
          className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-3 py-6 backdrop-blur-sm dark:bg-slate-950/75 sm:px-4 sm:py-10"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              closeManager();
            }
          }}
          role="dialog"
        >
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/50">
            <div className="max-h-[86vh] overflow-y-auto p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                    Local scenario library
                  </p>
                  <h2
                    className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100"
                    id="scenario-manager-dialog-heading"
                  >
                  Manage saved scenarios
                </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    These records live only in this browser under the named-scenario storage key. Use update snapshot when
                    the active planner inputs should replace a saved record.
                  </p>
                </div>
                <button className={classNames(secondaryButtonClassName, 'self-start')} onClick={closeManager} type="button">
                  Close
                </button>
              </div>

              <form
                className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50"
                onSubmit={handleSaveAs}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200" htmlFor="scenario-save-as-name">
                      Save active scenario as
                    </label>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Create a browser-local snapshot. Blank names use the default scenario name.
                    </p>
                    <input
                      className={classNames(formControlClassName(), 'mt-2')}
                      id="scenario-save-as-name"
                      onChange={(event) => setSaveName(event.target.value)}
                      placeholder="Scenario name"
                      ref={saveInputRef}
                      type="text"
                      value={saveName}
                    />
                  </div>
                  <button className={classNames(primaryButtonClassName, 'w-full lg:w-auto')} type="submit">
                    Save as
                  </button>
                </div>
              </form>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                      Compare candidates
                    </h3>
                    <p
                      className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400"
                      id="scenario-compare-selection-status"
                    >
                      Select exactly two saved scenarios, then launch compare. Selected: {selectedIds.length}/2.
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-500" id="scenario-compare-limit">
                      Once two are selected, choose a selected scenario again to free a slot.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span
                      className={classNames(
                        'rounded-full border px-3 py-1 text-xs font-semibold',
                        canCompare
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200'
                          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100',
                      )}
                    >
                      {canCompare ? 'Ready to compare' : 'Needs two selections'}
                    </span>
                    <button
                      className={classNames(primaryButtonClassName, 'w-full sm:w-auto')}
                      disabled={!canCompare}
                      onClick={launchCompare}
                      type="button"
                    >
                      Compare selected scenarios
                    </button>
                  </div>
                </div>
              </div>

              {scenarios.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">No saved scenarios yet.</p>
                  <p className="mt-1">
                    Save the active scenario to create a local snapshot. After you have two saved scenarios, comparison
                    controls will become available here.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 grid gap-3" aria-label="Saved scenarios">
                  {scenarios.map((scenario) => {
                    const isSelected = selectedIds.includes(scenario.id);
                    const cannotSelect = !isSelected && selectedIds.length >= 2;

                    return (
                      <li
                        className={classNames(
                          'rounded-2xl border p-4 transition-colors motion-reduce:transition-none',
                          isSelected
                            ? 'border-indigo-300 bg-indigo-50/70 dark:border-indigo-400/50 dark:bg-indigo-950/25'
                            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
                        )}
                        key={scenario.id}
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <label className="flex items-start gap-3 text-sm font-medium text-slate-950 dark:text-slate-100">
                              <input
                                aria-label={`Select ${scenario.name} for comparison`}
                                aria-describedby="scenario-compare-selection-status scenario-compare-limit"
                                checked={isSelected}
                                className={classNames(checkboxControlClassName(), 'mt-0.5 shrink-0')}
                                disabled={cannotSelect}
                                onChange={() => toggleCompareSelection(scenario.id)}
                                type="checkbox"
                              />
                              <span className="min-w-0">
                                <span className="block break-words">Select {scenario.name} for comparison</span>
                                <span className="mt-1 block text-xs font-normal leading-5 text-slate-500 dark:text-slate-400">
                                  Updated {formatSavedDate(scenario.updatedAt)}
                                </span>
                              </span>
                            </label>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                {formatScenarioYears(scenario)}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                {formatFilingStatus(scenario.scenario.filingStatus)}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                {scenario.scenario.state.incomeTaxLaw.stateCode}
                              </span>
                              {isSelected ? (
                                <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-semibold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-100">
                                  Selected
                                </span>
                              ) : null}
                              {scenario.plan === undefined ? (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                                  Missing saved plan
                                </span>
                              ) : null}
                            </div>
                            {cannotSelect ? (
                              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                                Two scenarios are already selected. Clear one before adding this scenario.
                              </p>
                            ) : null}
                          </div>
                          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/50 xl:w-[30rem]">
                            <label className="sr-only" htmlFor={`rename-${scenario.id}`}>
                              Rename {scenario.name}
                            </label>
                            <input
                              className={formControlClassName()}
                              id={`rename-${scenario.id}`}
                              onChange={(event) =>
                                setRenameValues((current) => ({ ...current, [scenario.id]: event.target.value }))
                              }
                              type="text"
                              value={renameValues[scenario.id] ?? scenario.name}
                            />
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <button
                                className={secondaryButtonClassName}
                                onClick={() => handleRename(scenario)}
                                type="button"
                              >
                                Rename
                              </button>
                              <button
                                className={secondaryButtonClassName}
                                onClick={() => handleUpdate(scenario)}
                                type="button"
                              >
                                Update snapshot
                              </button>
                              <button
                                className={secondaryButtonClassName}
                                onClick={() => handleDuplicate(scenario)}
                                type="button"
                              >
                                Duplicate
                              </button>
                              <button
                                className={destructiveButtonClassName}
                                onClick={() => handleDelete(scenario)}
                                type="button"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatSavedDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date);
}

function formatScenarioYears(scenario: SavedScenario): string {
  const endYear = scenario.plan?.endYear;

  return endYear === undefined ? `Starts ${scenario.scenario.startYear}` : `${scenario.scenario.startYear}-${endYear}`;
}

function formatFilingStatus(value: SavedScenario['scenario']['filingStatus']): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
