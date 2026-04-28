import { create } from 'zustand';

import type { ProjectionMetricFormValues } from '@/core/metrics';
import type { Scenario, YearBreakdown } from '@/core/projection';
import type { ThemePreference } from '@/lib/theme';

export type PlannerMode = 'basic' | 'advanced' | 'compare' | 'methodology';
export type DisplayUnit = 'real' | 'nominal';

export const UI_STORAGE_KEY = 'fire-planner.ui.v1';

export type ProjectionRunSnapshot = Readonly<{
  formValues: ProjectionMetricFormValues;
  projectionResults: readonly YearBreakdown[];
  scenario: Scenario;
}>;

export type UiStoreState = Readonly<{
  mode: PlannerMode;
  displayUnit: DisplayUnit;
  themePreference: ThemePreference;
  lastProjectionRunSnapshot: ProjectionRunSnapshot | null;
}>;

type UiStoreActions = {
  setMode: (mode: PlannerMode) => void;
  setDisplayUnit: (displayUnit: DisplayUnit) => void;
  setThemePreference: (themePreference: ThemePreference) => void;
  trackProjectionRunSnapshot: (snapshot: ProjectionRunSnapshot) => void;
  resetUiPreferences: () => void;
};

type PersistedUiState = Partial<Pick<UiStoreState, 'displayUnit' | 'mode' | 'themePreference'>>;

const DEFAULT_UI_STATE: UiStoreState = {
  mode: 'basic',
  displayUnit: 'real',
  themePreference: 'system',
  lastProjectionRunSnapshot: null,
};

export const useUiStore = create<UiStoreState & UiStoreActions>((set) => ({
  ...readInitialUiState(),
  setMode: (mode) => {
    set((state) => persistUiState({ ...state, mode }));
  },
  setDisplayUnit: (displayUnit) => {
    set((state) => persistUiState({ ...state, displayUnit }));
  },
  setThemePreference: (themePreference) => {
    set((state) => persistUiState({ ...state, themePreference }));
  },
  trackProjectionRunSnapshot: (snapshot) => {
    set({ lastProjectionRunSnapshot: snapshot });
  },
  resetUiPreferences: () => {
    set(persistUiState(DEFAULT_UI_STATE));
  },
}));

function readInitialUiState(): UiStoreState {
  const persisted = readPersistedUiState();

  return {
    mode: isPlannerMode(persisted.mode) ? persisted.mode : DEFAULT_UI_STATE.mode,
    displayUnit: isDisplayUnit(persisted.displayUnit) ? persisted.displayUnit : DEFAULT_UI_STATE.displayUnit,
    themePreference: isThemePreference(persisted.themePreference)
      ? persisted.themePreference
      : DEFAULT_UI_STATE.themePreference,
    lastProjectionRunSnapshot: null,
  };
}

function readPersistedUiState(): PersistedUiState {
  const storage = getLocalStorage();

  if (storage === null) {
    return {};
  }

  try {
    const raw = storage.getItem(UI_STORAGE_KEY);

    if (raw === null) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);

    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function persistUiState(state: UiStoreState): UiStoreState {
  const storage = getLocalStorage();

  if (storage !== null) {
    storage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        mode: state.mode,
        displayUnit: state.displayUnit,
        themePreference: state.themePreference,
      }),
    );
  }

  return state;
}

function isPlannerMode(value: unknown): value is PlannerMode {
  return value === 'basic' || value === 'advanced' || value === 'compare' || value === 'methodology';
}

function isDisplayUnit(value: unknown): value is DisplayUnit {
  return value === 'real' || value === 'nominal';
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
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
