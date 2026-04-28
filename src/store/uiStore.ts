import { create } from 'zustand';

import type { ProjectionMetricFormValues } from '@/core/metrics';
import type { Scenario, YearBreakdown } from '@/core/projection';
import type { ThemePreference } from '@/lib/theme';

export type PlannerMode = 'basic' | 'advanced' | 'compare' | 'methodology';
export type PlannerView = 'plan' | 'compare' | 'methodology';
export type DisplayUnit = 'real' | 'nominal';
export type PlannerLayout = 'classic' | 'verdict';

export const UI_STORAGE_KEY = 'fire-planner.ui.v1';

export type ProjectionRunSnapshot = Readonly<{
  formValues: ProjectionMetricFormValues;
  projectionResults: readonly YearBreakdown[];
  scenario: Scenario;
}>;

export type UiStoreState = Readonly<{
  mode: PlannerMode;
  view: PlannerView;
  displayUnit: DisplayUnit;
  layout: PlannerLayout;
  advancedDisclosed: boolean;
  themePreference: ThemePreference;
  lastProjectionRunSnapshot: ProjectionRunSnapshot | null;
}>;

type UiStoreActions = {
  setMode: (mode: PlannerMode) => void;
  setView: (view: PlannerView) => void;
  setDisplayUnit: (displayUnit: DisplayUnit) => void;
  setLayout: (layout: PlannerLayout) => void;
  setAdvancedDisclosed: (advancedDisclosed: boolean) => void;
  setThemePreference: (themePreference: ThemePreference) => void;
  trackProjectionRunSnapshot: (snapshot: ProjectionRunSnapshot) => void;
  resetUiPreferences: () => void;
};

type PersistedUiState = Partial<
  Pick<UiStoreState, 'advancedDisclosed' | 'displayUnit' | 'layout' | 'mode' | 'themePreference' | 'view'>
>;

const DEFAULT_UI_STATE: UiStoreState = {
  mode: 'basic',
  view: 'plan',
  displayUnit: 'real',
  layout: 'verdict',
  advancedDisclosed: false,
  themePreference: 'system',
  lastProjectionRunSnapshot: null,
};

export const useUiStore = create<UiStoreState & UiStoreActions>((set) => ({
  ...readInitialUiState(),
  setMode: (mode) => {
    set((state) => persistUiState(applyCompatibilityMode(state, mode)));
  },
  setView: (view) => {
    set((state) => persistUiState({ ...state, view }));
  },
  setDisplayUnit: (displayUnit) => {
    set((state) => persistUiState({ ...state, displayUnit }));
  },
  setLayout: (layout) => {
    set((state) => persistUiState({ ...state, layout }));
  },
  setAdvancedDisclosed: (advancedDisclosed) => {
    set((state) => persistUiState({ ...state, advancedDisclosed }));
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
  const hasPersistedView = isPlannerView(persisted.view);
  const view = hasPersistedView ? persisted.view : viewFromCompatibilityMode(persisted.mode);
  let advancedDisclosed =
    typeof persisted.advancedDisclosed === 'boolean' ? persisted.advancedDisclosed : DEFAULT_UI_STATE.advancedDisclosed;

  if (!hasPersistedView) {
    if (persisted.mode === 'advanced') {
      advancedDisclosed = true;
    } else if (persisted.mode === 'basic') {
      advancedDisclosed = false;
    }
  }

  return {
    mode: modeFromView(view, advancedDisclosed),
    view,
    displayUnit: isDisplayUnit(persisted.displayUnit) ? persisted.displayUnit : DEFAULT_UI_STATE.displayUnit,
    layout: isPlannerLayout(persisted.layout) ? persisted.layout : DEFAULT_UI_STATE.layout,
    advancedDisclosed,
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
  const nextState = {
    ...state,
    mode: modeFromView(state.view, state.advancedDisclosed),
  };

  if (storage !== null) {
    storage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        mode: nextState.mode,
        view: nextState.view,
        displayUnit: nextState.displayUnit,
        layout: nextState.layout,
        advancedDisclosed: nextState.advancedDisclosed,
        themePreference: nextState.themePreference,
      }),
    );
  }

  return nextState;
}

function isPlannerMode(value: unknown): value is PlannerMode {
  return value === 'basic' || value === 'advanced' || value === 'compare' || value === 'methodology';
}

function isPlannerView(value: unknown): value is PlannerView {
  return value === 'plan' || value === 'compare' || value === 'methodology';
}

function modeFromView(view: PlannerView, advancedDisclosed: boolean): PlannerMode {
  if (view === 'compare' || view === 'methodology') {
    return view;
  }

  return advancedDisclosed ? 'advanced' : 'basic';
}

function viewFromCompatibilityMode(mode: unknown): PlannerView {
  if (mode === 'compare' || mode === 'methodology') {
    return mode;
  }

  return DEFAULT_UI_STATE.view;
}

function applyCompatibilityMode(state: UiStoreState, mode: PlannerMode): UiStoreState {
  if (mode === 'basic') {
    return { ...state, advancedDisclosed: false, mode, view: 'plan' };
  }

  if (mode === 'advanced') {
    return { ...state, advancedDisclosed: true, mode, view: 'plan' };
  }

  return { ...state, mode, view: mode };
}

function isDisplayUnit(value: unknown): value is DisplayUnit {
  return value === 'real' || value === 'nominal';
}

function isPlannerLayout(value: unknown): value is PlannerLayout {
  return value === 'classic' || value === 'verdict';
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
