import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';

import type { CustomLaw } from '@/core/constants/customLaw';
import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { decodeScenario, encodeScenario } from '@/lib/urlHash';

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
  inflationRate: 0.025,
  annualMortgagePAndI: 0,
  mortgagePayoffYear: 0,
  annualW2Income: 140_000,
  annualContributionTraditional: 0,
  annualContributionRoth: 0,
  annualContributionHsa: 0,
  annualContributionBrokerage: 0,
  annualConsultingIncome: 0,
  annualRentalIncome: 0,
  annualSocialSecurityBenefit: 25_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 0,
  brokerageAndCashBalance: 300_000,
  taxableBrokerageBasis: 250_000,
  hsaBalance: 40_000,
  traditionalBalance: 500_000,
  rothBalance: 100_000,
  startingRothContributionBasis: 100_000,
  autoDepleteBrokerageEnabled: false,
  autoDepleteBrokerageYears: 10,
  autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
  expectedReturnTraditional: 0.05,
  expectedReturnRoth: 0.05,
  expectedReturnBrokerage: 0.05,
  expectedReturnHsa: 0.05,
  brokerageDividendYield: 0,
  brokerageQdiPercentage: 0.95,
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
  inflationRate: 0.04,
  annualMortgagePAndI: 24_000,
  mortgagePayoffYear: 2036,
  annualW2Income: 220_000,
  annualContributionTraditional: 10_000,
  annualContributionRoth: 7_000,
  annualContributionHsa: 4_000,
  annualContributionBrokerage: 12_000,
  annualConsultingIncome: 20_000,
  annualRentalIncome: 12_000,
  annualSocialSecurityBenefit: 55_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 18_000,
  brokerageAndCashBalance: 950_000,
  taxableBrokerageBasis: 700_000,
  hsaBalance: 75_000,
  traditionalBalance: 1_200_000,
  rothBalance: 320_000,
  startingRothContributionBasis: 320_000,
  autoDepleteBrokerageEnabled: true,
  autoDepleteBrokerageYears: 12,
  autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
  expectedReturnTraditional: 0.06,
  expectedReturnRoth: 0.07,
  expectedReturnBrokerage: 0.04,
  expectedReturnHsa: 0.03,
  brokerageDividendYield: 0.02,
  brokerageQdiPercentage: 0.9,
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
    expect(state.formValues.inflationRate).toBe(0.025);
    expect(state.formValues.stateCode).toBe('CA');
    expect(state.formValues.annualW2Income).toBe(550_000);
    expect(state.formValues.annualContributionTraditional).toBe(0);
    expect(state.formValues.annualContributionRoth).toBe(0);
    expect(state.formValues.annualContributionHsa).toBe(0);
    expect(state.formValues.annualContributionBrokerage).toBe(0);
    expect(state.formValues.brokerageAndCashBalance).toBe(1_000_000);
    expect(state.selectedStarterStateLaw.stateCode).toBe('CA');
    expect(state.scenario.state.incomeTaxLaw.stateCode).toBe('CA');
    expect(state.scenario.inflationRate).toBe(0.025);
    expect(state.plan.endYear).toBe(2066);
    expect(state.customLaw).toBeUndefined();
    expect(state.customLawActive).toBe(false);
    expect(state.projectionResults).toHaveLength(41);
    expect(state.scenario.balances).toMatchObject({
      hsa: 100_000,
      taxableBrokerage: 1_000_000,
      traditional: 2_000_000,
      roth: 1_000_000,
    });
    expect(state).not.toHaveProperty('hasRunProjection');
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
    expect(persisted.formValues?.hsaBalance).toBe(40_000);
    expect(persisted.scenario?.balances).toMatchObject({ hsa: 40_000 });
    expect(persisted.scenario?.state).toBeDefined();
    expect(persisted.plan?.endYear).toBe(2056);
    expect(persisted.customLawActive).toBe(false);
    expect(persisted).not.toHaveProperty('customLaw');
    expect(persisted).not.toHaveProperty('hasRunProjection');

    vi.resetModules();

    const { useScenarioStore: reloadedScenarioStore } = await import('@/store/scenarioStore');
    const reloadedState = reloadedScenarioStore.getState();

    expect(reloadedState.formValues).toEqual(STORED_FORM_VALUES);
    expect(reloadedState.scenario.balances.hsa).toBe(40_000);
    expect(reloadedState.scenario.state.incomeTaxLaw.stateCode).toBe('FL');
    expect(reloadedState.customLawActive).toBe(false);
    expect(reloadedState.customLaw).toBeUndefined();
    expect(reloadedState.projectionResults.length).toBeGreaterThan(0);
    expect(reloadedState).not.toHaveProperty('hasRunProjection');
  });

  it('hydrates legacy persisted basic form values without inflation or contributions at compatibility defaults', async () => {
    const { scenario, plan } = mapBasicFormToProjectionInputs({ ...STORED_FORM_VALUES, inflationRate: 0.03 });
    const {
      annualContributionTraditional: _ignoredScenarioTraditionalContribution,
      annualContributionRoth: _ignoredScenarioRothContribution,
      annualContributionHsa: _ignoredScenarioHsaContribution,
      annualContributionBrokerage: _ignoredScenarioBrokerageContribution,
      ...legacyScenario
    } = scenario;
    const {
      inflationRate: _ignoredInflationRate,
      annualContributionTraditional: _ignoredTraditionalContribution,
      annualContributionRoth: _ignoredRothContribution,
      annualContributionHsa: _ignoredHsaContribution,
      annualContributionBrokerage: _ignoredBrokerageContribution,
      ...legacyFormValues
    } = STORED_FORM_VALUES;
    window.localStorage.setItem(
      'fire-planner.scenario.v1',
      JSON.stringify({
        formValues: legacyFormValues,
        scenario: legacyScenario,
        plan,
        customLawActive: false,
      }),
    );

    const { SCENARIO_STORAGE_KEY, useScenarioStore } = await import('@/store/scenarioStore');
    const state = useScenarioStore.getState();

    expect(state.formValues.inflationRate).toBe(0.025);
    expect(state.formValues.annualContributionTraditional).toBe(0);
    expect(state.formValues.annualContributionRoth).toBe(0);
    expect(state.formValues.annualContributionHsa).toBe(0);
    expect(state.formValues.annualContributionBrokerage).toBe(0);
    expect(state.scenario.inflationRate).toBe(0.025);
    expect(state.scenario.annualContributionTraditional).toBe(0);
    expect(state.scenario.annualContributionRoth).toBe(0);
    expect(state.scenario.annualContributionHsa).toBe(0);
    expect(state.scenario.annualContributionBrokerage).toBe(0);

    useScenarioStore.getState().setFormValues({ annualSpendingToday: 81_000 });

    const persisted = JSON.parse(window.localStorage.getItem(SCENARIO_STORAGE_KEY) ?? '{}') as {
      formValues?: Record<string, unknown>;
      scenario?: Record<string, unknown>;
    };
    expect(persisted.formValues?.inflationRate).toBe(0.025);
    expect(persisted.formValues?.annualContributionTraditional).toBe(0);
    expect(persisted.formValues?.annualContributionRoth).toBe(0);
    expect(persisted.formValues?.annualContributionHsa).toBe(0);
    expect(persisted.formValues?.annualContributionBrokerage).toBe(0);
    expect(persisted.scenario?.inflationRate).toBe(0.025);
    expect(persisted.scenario?.annualContributionTraditional).toBe(0);
    expect(persisted.scenario?.annualContributionRoth).toBe(0);
    expect(persisted.scenario?.annualContributionHsa).toBe(0);
    expect(persisted.scenario?.annualContributionBrokerage).toBe(0);
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
    expect(state.formValues.inflationRate).toBe(HASH_FORM_VALUES.inflationRate);
    expect(state.formValues.annualW2Income).toBe(HASH_FORM_VALUES.annualW2Income);
    expect(state.formValues.annualContributionTraditional).toBe(HASH_FORM_VALUES.annualContributionTraditional);
    expect(state.formValues.annualContributionRoth).toBe(HASH_FORM_VALUES.annualContributionRoth);
    expect(state.formValues.annualContributionHsa).toBe(HASH_FORM_VALUES.annualContributionHsa);
    expect(state.formValues.annualContributionBrokerage).toBe(HASH_FORM_VALUES.annualContributionBrokerage);
    expect(state.formValues.hsaBalance).toBe(HASH_FORM_VALUES.hsaBalance);
    expect(state.formValues.annualMortgagePAndI).toBe(HASH_FORM_VALUES.annualMortgagePAndI);
    expect(state.formValues.expectedReturnTraditional).toBe(HASH_FORM_VALUES.expectedReturnTraditional);
    expect(state.formValues.autoDepleteBrokerageEnabled).toBe(true);
    expect(state.formValues.autoDepleteBrokerageYears).toBe(HASH_FORM_VALUES.autoDepleteBrokerageYears);
    expect(state.formValues.autoDepleteBrokerageAnnualScaleUpFactor).toBe(
      HASH_FORM_VALUES.autoDepleteBrokerageAnnualScaleUpFactor,
    );
    expect(state.formValues.expectedReturnRoth).toBe(HASH_FORM_VALUES.expectedReturnRoth);
    expect(state.formValues.expectedReturnBrokerage).toBe(HASH_FORM_VALUES.expectedReturnBrokerage);
    expect(state.formValues.expectedReturnHsa).toBe(HASH_FORM_VALUES.expectedReturnHsa);
    expect(state.formValues.brokerageDividendYield).toBe(HASH_FORM_VALUES.brokerageDividendYield);
    expect(state.formValues.brokerageQdiPercentage).toBe(HASH_FORM_VALUES.brokerageQdiPercentage);
    expect(state.plan).toEqual(sharedPlan);
    expect(state.scenario.state.incomeTaxLaw.stateCode).toBe('PA');
    expect(state.scenario.inflationRate).toBe(HASH_FORM_VALUES.inflationRate);
    expect(state.scenario.annualContributionTraditional).toBe(HASH_FORM_VALUES.annualContributionTraditional);
    expect(state.scenario.annualContributionRoth).toBe(HASH_FORM_VALUES.annualContributionRoth);
    expect(state.scenario.annualContributionHsa).toBe(HASH_FORM_VALUES.annualContributionHsa);
    expect(state.scenario.annualContributionBrokerage).toBe(HASH_FORM_VALUES.annualContributionBrokerage);
    expect(state.scenario.mortgage).toEqual({ annualPI: 24_000, payoffYear: 2036 });
    expect(state.scenario.expectedReturns).toEqual({
      cash: 0,
      hsa: 0.03,
      taxableBrokerage: 0.04,
      traditional: 0.06,
      roth: 0.07,
    });
    expect(state.scenario.brokerageDividends).toEqual({ annualYield: 0.02, qdiPercentage: 0.9 });
    expect(state.scenario.autoDepleteBrokerage).toEqual({
      enabled: true,
      yearsToDeplete: 12,
      annualScaleUpFactor: 0.02,
      excludeMortgageFromRate: false,
      retirementYear: 2029,
    });
    expect(state.customLawActive).toBe(false);
    expect(state.customLaw).toBeUndefined();
    expect(state.projectionResults[0]?.conversions).toBe(50_000);
    expect(state.projectionResults[0]?.brokerageHarvests).toBe(10_000);
    expect(state.projectionResults.map((year) => year.year)[0]).toBe(HASH_FORM_VALUES.currentYear);

    const persisted = JSON.parse(window.localStorage.getItem(SCENARIO_STORAGE_KEY) ?? '{}') as {
      formValues?: Record<string, unknown>;
    };
    expect(persisted.formValues?.stateCode).toBe('PA');
    expect(persisted.formValues?.inflationRate).toBe(HASH_FORM_VALUES.inflationRate);
    expect(persisted.formValues?.hsaBalance).toBe(HASH_FORM_VALUES.hsaBalance);
    expect(persisted.formValues?.annualMortgagePAndI).toBe(HASH_FORM_VALUES.annualMortgagePAndI);
    expect(persisted.formValues?.annualContributionTraditional).toBe(HASH_FORM_VALUES.annualContributionTraditional);
    expect(persisted.formValues?.annualContributionRoth).toBe(HASH_FORM_VALUES.annualContributionRoth);
    expect(persisted.formValues?.annualContributionHsa).toBe(HASH_FORM_VALUES.annualContributionHsa);
    expect(persisted.formValues?.annualContributionBrokerage).toBe(HASH_FORM_VALUES.annualContributionBrokerage);
    expect(persisted.formValues?.expectedReturnTraditional).toBe(HASH_FORM_VALUES.expectedReturnTraditional);
    expect(persisted.formValues?.autoDepleteBrokerageEnabled).toBe(true);
    expect(persisted.formValues?.autoDepleteBrokerageYears).toBe(HASH_FORM_VALUES.autoDepleteBrokerageYears);
    expect(persisted.formValues?.autoDepleteBrokerageAnnualScaleUpFactor).toBe(
      HASH_FORM_VALUES.autoDepleteBrokerageAnnualScaleUpFactor,
    );
    expect(persisted.formValues?.expectedReturnRoth).toBe(HASH_FORM_VALUES.expectedReturnRoth);
    expect(persisted.formValues?.expectedReturnBrokerage).toBe(HASH_FORM_VALUES.expectedReturnBrokerage);
    expect(persisted.formValues?.expectedReturnHsa).toBe(HASH_FORM_VALUES.expectedReturnHsa);
    expect(persisted.formValues?.brokerageDividendYield).toBe(HASH_FORM_VALUES.brokerageDividendYield);
    expect(persisted.formValues?.brokerageQdiPercentage).toBe(HASH_FORM_VALUES.brokerageQdiPercentage);
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

  it('hydrates URL hashes that omit inflation and contributions with compatibility defaults and re-shares them', async () => {
    const { scenario, plan } = mapBasicFormToProjectionInputs(HASH_FORM_VALUES);
    const {
      inflationRate: _ignoredInflationRate,
      annualContributionTraditional: _ignoredTraditionalContribution,
      annualContributionRoth: _ignoredRothContribution,
      annualContributionHsa: _ignoredHsaContribution,
      annualContributionBrokerage: _ignoredBrokerageContribution,
      ...legacyScenario
    } = scenario;
    window.location.hash = `v1:${compressToEncodedURIComponent(JSON.stringify({ scenario: legacyScenario, plan }))}`;

    const { useScenarioStore } = await import('@/store/scenarioStore');
    const state = useScenarioStore.getState();

    expect(state.formValues.inflationRate).toBe(0.025);
    expect(state.formValues.annualContributionTraditional).toBe(0);
    expect(state.formValues.annualContributionRoth).toBe(0);
    expect(state.formValues.annualContributionHsa).toBe(0);
    expect(state.formValues.annualContributionBrokerage).toBe(0);
    expect(state.scenario.inflationRate).toBe(0.025);
    expect(state.scenario.annualContributionTraditional).toBe(0);
    expect(state.scenario.annualContributionRoth).toBe(0);
    expect(state.scenario.annualContributionHsa).toBe(0);
    expect(state.scenario.annualContributionBrokerage).toBe(0);

    const reshared = decodeScenario(encodeScenario({ scenario: state.scenario, plan: state.plan }));
    expect(reshared?.scenario.inflationRate).toBe(0.025);
    expect(reshared?.scenario.annualContributionTraditional).toBe(0);
    expect(reshared?.scenario.annualContributionRoth).toBe(0);
    expect(reshared?.scenario.annualContributionHsa).toBe(0);
    expect(reshared?.scenario.annualContributionBrokerage).toBe(0);
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
