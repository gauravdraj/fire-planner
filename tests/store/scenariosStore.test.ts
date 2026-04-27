import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';

import { installMemoryLocalStorage } from './memoryStorage';

const FORM_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'single',
  stateCode: 'FL',
  primaryAge: 50,
  partnerAge: 50,
  retirementYear: 2030,
  planEndAge: 80,
  annualSpendingToday: 80_000,
  annualW2Income: 140_000,
  annualConsultingIncome: 0,
  annualRentalIncome: 0,
  annualSocialSecurityBenefit: 25_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 0,
  brokerageAndCashBalance: 300_000,
  taxableBrokerageBasis: 250_000,
  traditionalBalance: 500_000,
  rothBalance: 100_000,
  healthcarePhase: 'none',
};

const ALTERNATE_FORM_VALUES: BasicFormValues = {
  ...FORM_VALUES,
  stateCode: 'CA',
  annualSpendingToday: 120_000,
  brokerageAndCashBalance: 900_000,
};

describe('scenariosStore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T08:45:00.000Z'));
    installMemoryLocalStorage();
    window.location.hash = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves and loads named scenarios from the local-only scenarios key', async () => {
    const { SCENARIOS_STORAGE_KEY, useScenariosStore } = await import('@/store/scenariosStore');
    const { scenario, plan } = mapBasicFormToProjectionInputs(FORM_VALUES);

    const saved = useScenariosStore.getState().save({ name: 'Baseline', scenario, plan });

    expect(saved.name).toBe('Baseline');
    expect(saved.scenario).toEqual(scenario);
    expect(saved.plan).toEqual(plan);
    expect(saved.updatedAt).toBe('2026-04-27T08:45:00.000Z');
    expect(useScenariosStore.getState().load(saved.id)).toEqual(saved);
    expect(useScenariosStore.getState().list()).toEqual([saved]);
    expect(JSON.parse(window.localStorage.getItem(SCENARIOS_STORAGE_KEY) ?? '[]')).toEqual([saved]);
    expect(window.localStorage.getItem('fire-planner.scenario.v1')).toBeNull();
  });

  it('defaults the first explicit save name when no name is provided', async () => {
    const { DEFAULT_SCENARIO_NAME, useScenariosStore } = await import('@/store/scenariosStore');
    const { scenario, plan } = mapBasicFormToProjectionInputs(FORM_VALUES);

    const saved = useScenariosStore.getState().save({ scenario, plan });

    expect(saved.name).toBe(DEFAULT_SCENARIO_NAME);
  });

  it('duplicates, renames, deletes, and lists saved scenarios', async () => {
    const { useScenariosStore } = await import('@/store/scenariosStore');
    const { scenario, plan } = mapBasicFormToProjectionInputs(FORM_VALUES);
    const saved = useScenariosStore.getState().save({ name: 'Baseline', scenario, plan });

    vi.setSystemTime(new Date('2026-04-27T08:46:00.000Z'));
    const duplicated = useScenariosStore.getState().duplicate(saved.id, 'Optimized');

    expect(duplicated).not.toBeNull();
    expect(duplicated?.id).not.toBe(saved.id);
    expect(duplicated?.name).toBe('Optimized');
    expect(duplicated?.scenario).toEqual(saved.scenario);
    expect(duplicated?.plan).toEqual(saved.plan);
    expect(duplicated?.updatedAt).toBe('2026-04-27T08:46:00.000Z');

    vi.setSystemTime(new Date('2026-04-27T08:47:00.000Z'));
    const renamed = useScenariosStore.getState().rename(duplicated?.id ?? '', 'Optimized v2');

    expect(renamed?.name).toBe('Optimized v2');
    expect(renamed?.updatedAt).toBe('2026-04-27T08:47:00.000Z');
    expect(useScenariosStore.getState().delete(saved.id)).toBe(true);
    expect(useScenariosStore.getState().delete('missing')).toBe(false);
    expect(useScenariosStore.getState().list()).toEqual([renamed]);
  });

  it('recovers from malformed scenario storage and replaces it on the next save', async () => {
    const { SCENARIOS_STORAGE_KEY, useScenariosStore } = await import('@/store/scenariosStore');
    const { scenario, plan } = mapBasicFormToProjectionInputs(FORM_VALUES);

    window.localStorage.setItem(SCENARIOS_STORAGE_KEY, 'not json');
    vi.resetModules();

    const { useScenariosStore: reloadedScenariosStore } = await import('@/store/scenariosStore');

    expect(reloadedScenariosStore.getState().list()).toEqual([]);

    const saved = reloadedScenariosStore.getState().save({ name: 'Recovered', scenario, plan });

    expect(JSON.parse(window.localStorage.getItem(SCENARIOS_STORAGE_KEY) ?? '[]')).toEqual([saved]);
    expect(useScenariosStore.getState().list()).toEqual([]);
  });

  it('auto-saves the default scenario once on the first projection run', async () => {
    const [{ DEFAULT_SCENARIO_NAME, useScenariosStore }, { useScenarioStore }] = await Promise.all([
      import('@/store/scenariosStore'),
      import('@/store/scenarioStore'),
    ]);

    expect(useScenariosStore.getState().list()).toEqual([]);

    useScenarioStore.getState().replaceFormValues(FORM_VALUES);

    const activeState = useScenarioStore.getState();
    const [saved] = useScenariosStore.getState().list();

    expect(saved?.name).toBe(DEFAULT_SCENARIO_NAME);
    expect(saved?.scenario).toEqual(activeState.scenario);
    expect(saved?.plan).toEqual(activeState.plan);

    useScenarioStore.getState().replaceFormValues(ALTERNATE_FORM_VALUES);

    expect(useScenariosStore.getState().list()).toEqual([saved]);
  });

  it('does not overwrite existing named scenarios during projection auto-save', async () => {
    const [{ useScenariosStore }, { useScenarioStore }] = await Promise.all([
      import('@/store/scenariosStore'),
      import('@/store/scenarioStore'),
    ]);
    const { scenario, plan } = mapBasicFormToProjectionInputs(FORM_VALUES);
    const existing = useScenariosStore.getState().save({ name: 'Existing plan', scenario, plan });

    useScenarioStore.getState().replaceFormValues(ALTERNATE_FORM_VALUES);

    expect(useScenariosStore.getState().list()).toEqual([existing]);
  });
});
