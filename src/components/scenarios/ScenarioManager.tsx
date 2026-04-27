import { type FormEvent, useEffect, useRef, useState } from 'react';

import { useScenarioStore } from '@/store/scenarioStore';
import { type SavedScenario, useScenariosStore } from '@/store/scenariosStore';

type ScenarioManagerProps = {
  onCompare?: (scenarioIds: readonly [string, string]) => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

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
    <section aria-labelledby="scenario-manager-heading" className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold" id="scenario-manager-heading">
            Scenario manager
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Save local named scenarios, duplicate alternatives, and launch a two-scenario comparison.
          </p>
        </div>
        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          onClick={openManager}
          ref={triggerRef}
          type="button"
        >
          Manage scenarios
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Named scenarios are stored only in this browser and are not added to share links.
      </p>
      {status.length > 0 ? (
        <p className="mt-3 text-sm font-medium text-emerald-700" role="status">
          {status}
        </p>
      ) : null}

      {isOpen ? (
        <div
          aria-labelledby="scenario-manager-dialog-heading"
          aria-modal="true"
          className="fixed inset-0 z-20 flex items-start justify-center bg-slate-950/40 px-4 py-10"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              closeManager();
            }
          }}
          role="dialog"
        >
          <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold" id="scenario-manager-dialog-heading">
                  Manage saved scenarios
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  These records live in localStorage under the named-scenario key only.
                </p>
              </div>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={closeManager}
                type="button"
              >
                Close
              </button>
            </div>

            <form className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={handleSaveAs}>
              <label className="text-sm font-medium text-slate-700" htmlFor="scenario-save-as-name">
                Save active scenario as
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  id="scenario-save-as-name"
                  onChange={(event) => setSaveName(event.target.value)}
                  placeholder="Scenario name"
                  ref={saveInputRef}
                  type="text"
                  value={saveName}
                />
                <button
                  className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-600"
                  type="submit"
                >
                  Save as
                </button>
              </div>
            </form>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Select exactly two saved scenarios, then launch compare. Selected: {selectedIds.length}/2.
              </p>
              <button
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={selectedIds.length !== 2}
                onClick={launchCompare}
                type="button"
              >
                Compare selected scenarios
              </button>
            </div>

            {scenarios.length === 0 ? (
              <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                No saved scenarios yet. Save the active scenario to start comparing plans.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" aria-label="Saved scenarios">
                {scenarios.map((scenario) => {
                  const isSelected = selectedIds.includes(scenario.id);
                  const cannotSelect = !isSelected && selectedIds.length >= 2;

                  return (
                    <li className="rounded-lg border border-slate-200 p-4" key={scenario.id}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-950">
                            <input
                              checked={isSelected}
                              disabled={cannotSelect}
                              onChange={() => toggleCompareSelection(scenario.id)}
                              type="checkbox"
                            />
                            Select {scenario.name} for comparison
                          </label>
                          <p className="mt-1 text-xs text-slate-500">
                            Updated {formatSavedDate(scenario.updatedAt)}
                            {scenario.plan === undefined ? ' · missing saved plan' : ''}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <label className="sr-only" htmlFor={`rename-${scenario.id}`}>
                            Rename {scenario.name}
                          </label>
                          <input
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                            id={`rename-${scenario.id}`}
                            onChange={(event) =>
                              setRenameValues((current) => ({ ...current, [scenario.id]: event.target.value }))
                            }
                            type="text"
                            value={renameValues[scenario.id] ?? scenario.name}
                          />
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            onClick={() => handleRename(scenario)}
                            type="button"
                          >
                            Rename
                          </button>
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            onClick={() => handleDuplicate(scenario)}
                            type="button"
                          >
                            Duplicate
                          </button>
                          <button
                            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(scenario)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
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
