import { create } from 'zustand';

import type { Scenario, WithdrawalPlan } from '@/core/projection';

export const SCENARIOS_STORAGE_KEY = 'fire-planner.scenarios.v1';
export const DEFAULT_SCENARIO_NAME = 'Default scenario';

// Named scenarios are separate from the Gate 3 active-scenario key; this store
// only writes its own localStorage slot and never migrates or mutates active state.

export type SavedScenario = Readonly<{
  id: string;
  name: string;
  scenario: Scenario;
  plan?: WithdrawalPlan;
  updatedAt: string;
}>;

type SaveScenarioInput = Readonly<{
  id?: string | undefined;
  name?: string | undefined;
  scenario: Scenario;
  plan?: WithdrawalPlan | undefined;
}>;

type ScenariosStoreState = Readonly<{
  scenarios: readonly SavedScenario[];
}>;

type ScenariosStoreActions = {
  save: (input: SaveScenarioInput) => SavedScenario;
  load: (id: string) => SavedScenario | null;
  duplicate: (id: string, name?: string) => SavedScenario | null;
  delete: (id: string) => boolean;
  rename: (id: string, name: string) => SavedScenario | null;
  list: () => readonly SavedScenario[];
  saveDefaultScenarioOnce: (input: Omit<SaveScenarioInput, 'id' | 'name'>) => SavedScenario | null;
};

export const useScenariosStore = create<ScenariosStoreState & ScenariosStoreActions>((set, get) => ({
  scenarios: readSavedScenarios(),
  save: (input) => {
    let savedScenario: SavedScenario | null = null;

    set((state) => {
      const id = nonemptyString(input.id) ?? createScenarioId();
      const nextScenario = createSavedScenario({
        id,
        name: scenarioName(input.name, DEFAULT_SCENARIO_NAME),
        scenario: input.scenario,
        plan: input.plan,
      });
      const existingIndex = state.scenarios.findIndex((scenario) => scenario.id === id);
      const scenarios =
        existingIndex === -1
          ? [...state.scenarios, nextScenario]
          : state.scenarios.map((scenario, index) => (index === existingIndex ? nextScenario : scenario));

      savedScenario = nextScenario;
      return persistScenariosState({ scenarios });
    });

    return (
      savedScenario ??
      createSavedScenario({
        id: nonemptyString(input.id) ?? createScenarioId(),
        name: scenarioName(input.name, DEFAULT_SCENARIO_NAME),
        scenario: input.scenario,
        plan: input.plan,
      })
    );
  },
  load: (id) => get().scenarios.find((scenario) => scenario.id === id) ?? null,
  duplicate: (id, name) => {
    const source = get().load(id);

    if (source === null) {
      return null;
    }

    return get().save({
      name: scenarioName(name, `${source.name} copy`),
      scenario: source.scenario,
      plan: source.plan,
    });
  },
  delete: (id) => {
    const scenarios = get().scenarios.filter((scenario) => scenario.id !== id);

    if (scenarios.length === get().scenarios.length) {
      return false;
    }

    set(persistScenariosState({ scenarios }));
    return true;
  },
  rename: (id, name) => {
    const source = get().load(id);

    if (source === null) {
      return null;
    }

    return get().save({
      id,
      name: scenarioName(name, source.name),
      scenario: source.scenario,
      plan: source.plan,
    });
  },
  list: () => get().scenarios,
  saveDefaultScenarioOnce: (input) => {
    if (get().scenarios.length > 0) {
      return null;
    }

    return get().save({ ...input, name: DEFAULT_SCENARIO_NAME });
  },
}));

function readSavedScenarios(): readonly SavedScenario[] {
  const storage = getLocalStorage();

  if (storage === null) {
    return [];
  }

  try {
    const raw = storage.getItem(SCENARIOS_STORAGE_KEY);

    if (raw === null) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter(isSavedScenario) : [];
  } catch {
    return [];
  }
}

function persistScenariosState(state: ScenariosStoreState): ScenariosStoreState {
  const storage = getLocalStorage();

  if (storage !== null) {
    storage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify(state.scenarios));
  }

  return state;
}

function createSavedScenario(input: Readonly<{
  id: string;
  name: string;
  scenario: Scenario;
  plan?: WithdrawalPlan | undefined;
}>): SavedScenario {
  const base = {
    id: input.id,
    name: input.name,
    scenario: input.scenario,
    updatedAt: new Date().toISOString(),
  };

  return input.plan === undefined ? base : { ...base, plan: input.plan };
}

function createScenarioId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();

  return randomId === undefined ? `scenario-${Date.now()}-${Math.random().toString(36).slice(2)}` : randomId;
}

function scenarioName(name: string | undefined, fallback: string): string {
  return nonemptyString(name) ?? fallback;
}

function nonemptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isSavedScenario(value: unknown): value is SavedScenario {
  if (!isRecord(value)) {
    return false;
  }

  const hasPlan = value.plan === undefined || isRecord(value.plan);

  return (
    nonemptyString(value.id) !== null &&
    nonemptyString(value.name) !== null &&
    isRecord(value.scenario) &&
    hasPlan &&
    nonemptyString(value.updatedAt) !== null
  );
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
