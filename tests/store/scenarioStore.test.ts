import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';

import type { CustomLaw } from '@/core/constants/customLaw';
import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { encodeScenario } from '@/lib/urlHash';

import { installMemoryLocalStorage } from './memoryStorage';

const STORED_FORM_VALUES: BasicFormValues = {
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

const HASH_FORM_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'mfj',
  stateCode: 'PA',
  primaryAge: 62,
  partnerAge: 66,
  retirementYear: 2029,
  planEndAge: 92,
  annualSpendingToday: 135_000,
  annualW2Income: 220_000,
  annualConsultingIncome: 20_000,
  annualRentalIncome: 12_000,
  annualSocialSecurityBenefit: 55_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 18_000,
  brokerageAndCashBalance: 950_000,
  taxableBrokerageBasis: 700_000,
  traditionalBalance: 1_200_000,
  rothBalance: 320_000,
  healthcarePhase: 'aca',
};

const CUSTOM_LAW = {
  federal: {
    standardDeduction: {
      single: 20_000,
      mfj: 40_000,
      hoh: 30_000,
      mfs: 20_000,
    },
  },
} satisfies CustomLaw;

describe('scenarioStore', () => {
  beforeEach(() => {
    vi.resetModules();
    installMemoryLocalStorage();
    window.location.hash = '';
  });

  it('defaults to a California basic form and runs a projection', async () => {
    const { DEFAULT_BASIC_FORM_VALUES, useScenarioStore } = await import('@/store/scenarioStore');
    const state = useScenarioStore.getState();

    expect(state.formValues).toEqual(DEFAULT_BASIC_FORM_VALUES);
    expect(state.formValues.stateCode).toBe('CA');
    expect(state.selectedStarterStateLaw.stateCode).toBe('CA');
    expect(state.scenario.state.incomeTaxLaw.stateCode).toBe('CA');
    expect(state.plan.endYear).toBe(2066);
    expect(state.customLaw).toBeUndefined();
    expect(state.customLawActive).toBe(false);
    expect(state.projectionResults).toHaveLength(41);
    expect(state.scenario.balances).not.toHaveProperty('hsa');
  });

  it('persists active scenario inputs and rehydrates from localStorage without breaking basic mode', async () => {
    const { SCENARIO_STORAGE_KEY, useScenarioStore } = await import('@/store/scenarioStore');

    useScenarioStore.getState().replaceFormValues(STORED_FORM_VALUES);

    const persisted = JSON.parse(window.localStorage.getItem(SCENARIO_STORAGE_KEY) ?? '{}') as {
      formValues?: Record<string, unknown>;
      scenario?: Record<string, unknown>;
      plan?: Record<string, unknown>;
      customLawActive?: unknown;
    };

    expect(persisted.formValues).toEqual(STORED_FORM_VALUES);
    expect(persisted.formValues).not.toHaveProperty('hsa');
    expect(persisted.formValues).not.toHaveProperty('hsaBalance');
    expect(persisted.scenario?.state).toBeDefined();
    expect(persisted.plan?.endYear).toBe(2056);
    expect(persisted.customLawActive).toBe(false);
    expect(persisted).not.toHaveProperty('customLaw');

    vi.resetModules();

    const { useScenarioStore: reloadedScenarioStore } = await import('@/store/scenarioStore');
    const reloadedState = reloadedScenarioStore.getState();

    expect(reloadedState.formValues).toEqual(STORED_FORM_VALUES);
    expect(reloadedState.scenario.state.incomeTaxLaw.stateCode).toBe('FL');
    expect(reloadedState.customLawActive).toBe(false);
    expect(reloadedState.customLaw).toBeUndefined();
    expect(reloadedState.projectionResults.length).toBeGreaterThan(0);
  });

  it('applies a valid URL hash before localStorage and uses the mapped projection inputs', async () => {
    const { scenario, plan } = mapBasicFormToProjectionInputs(HASH_FORM_VALUES);
    const sharedPlan = {
      ...plan,
      rothConversions: [{ year: HASH_FORM_VALUES.currentYear, amount: 50_000 }],
      brokerageHarvests: [{ year: HASH_FORM_VALUES.currentYear, amount: 10_000 }],
    };
    window.localStorage.setItem(
      'fire-planner.scenario.v1',
      JSON.stringify({
        formValues: {
          ...STORED_FORM_VALUES,
          hsaBalance: 999_999,
        },
      }),
    );
    window.location.hash = encodeScenario({ scenario, plan: sharedPlan });

    const { SCENARIO_STORAGE_KEY, useScenarioStore } = await import('@/store/scenarioStore');
    const state = useScenarioStore.getState();

    expect(state.formValues.stateCode).toBe('PA');
    expect(state.formValues.annualSpendingToday).toBe(HASH_FORM_VALUES.annualSpendingToday);
    expect(state.formValues.annualW2Income).toBe(HASH_FORM_VALUES.annualW2Income);
    expect(state.plan).toEqual(sharedPlan);
    expect(state.scenario.state.incomeTaxLaw.stateCode).toBe('PA');
    expect(state.customLawActive).toBe(false);
    expect(state.customLaw).toBeUndefined();
    expect(state.projectionResults[0]?.conversions).toBe(50_000);
    expect(state.projectionResults[0]?.brokerageHarvests).toBe(10_000);
    expect(state.projectionResults.map((year) => year.year)[0]).toBe(HASH_FORM_VALUES.currentYear);

    const persisted = JSON.parse(window.localStorage.getItem(SCENARIO_STORAGE_KEY) ?? '{}') as {
      formValues?: Record<string, unknown>;
    };
    expect(persisted.formValues?.stateCode).toBe('PA');
    expect(persisted.formValues).not.toHaveProperty('hsaBalance');
  });

  it('hydrates active custom-law state from URL hashes and persists it locally', async () => {
    const { scenario, plan } = mapBasicFormToProjectionInputs(HASH_FORM_VALUES);
    window.location.hash = encodeScenario({ scenario, plan, customLaw: CUSTOM_LAW, customLawActive: true });

    const { SCENARIO_STORAGE_KEY, useScenarioStore } = await import('@/store/scenarioStore');
    const state = useScenarioStore.getState();

    expect(state.customLaw).toEqual(CUSTOM_LAW);
    expect(state.customLawActive).toBe(true);
    expect(state.scenario.customLaw).toEqual(CUSTOM_LAW);
    expect(state.projectionResults.length).toBeGreaterThan(0);

    const persisted = JSON.parse(window.localStorage.getItem(SCENARIO_STORAGE_KEY) ?? '{}') as {
      customLaw?: unknown;
      customLawActive?: unknown;
      scenario?: { customLaw?: unknown };
    };

    expect(persisted.customLaw).toEqual(CUSTOM_LAW);
    expect(persisted.customLawActive).toBe(true);
    expect(persisted.scenario?.customLaw).toEqual(CUSTOM_LAW);
  });

  it('hydrates legacy Gate 3 URL hashes that only include scenario and plan', async () => {
    const { scenario, plan } = mapBasicFormToProjectionInputs(HASH_FORM_VALUES);
    window.location.hash = `v1:${compressToEncodedURIComponent(JSON.stringify({ scenario, plan }))}`;

    const { useScenarioStore } = await import('@/store/scenarioStore');
    const state = useScenarioStore.getState();

    expect(state.formValues.stateCode).toBe('PA');
    expect(state.plan).toEqual(plan);
    expect(state.customLawActive).toBe(false);
    expect(state.customLaw).toBeUndefined();
    expect(state.scenario.customLaw).toBeUndefined();
  });

  it('does not activate the custom-law banner without non-empty decoded overrides', async () => {
    const { scenario, plan } = mapBasicFormToProjectionInputs(HASH_FORM_VALUES);
    window.location.hash = `v1:${compressToEncodedURIComponent(
      JSON.stringify({ scenario, plan, customLaw: {}, customLawActive: true }),
    )}`;

    const { useScenarioStore } = await import('@/store/scenarioStore');
    const state = useScenarioStore.getState();

    expect(state.customLaw).toEqual({});
    expect(state.customLawActive).toBe(false);
    expect(state.scenario.customLaw).toBeUndefined();
  });

  it('ignores malformed URL hashes and falls back to localStorage', async () => {
    window.localStorage.setItem(
      'fire-planner.scenario.v1',
      JSON.stringify({
        formValues: STORED_FORM_VALUES,
      }),
    );
    window.location.hash = '#v1:not-valid-compressed-data';

    const { useScenarioStore } = await import('@/store/scenarioStore');
    const state = useScenarioStore.getState();

    expect(state.formValues).toEqual(STORED_FORM_VALUES);
    expect(state.scenario.state.incomeTaxLaw.stateCode).toBe('FL');
    expect(state.projectionResults.length).toBeGreaterThan(0);
  });
});
