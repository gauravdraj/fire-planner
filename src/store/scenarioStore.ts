import { create } from 'zustand';

import { CALIFORNIA_STATE_TAX } from '@/core/constants/states/california';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import { PENNSYLVANIA_STATE_TAX } from '@/core/constants/states/pennsylvania';
import { isCustomLawActive, type CustomLaw } from '@/core/constants/customLaw';
import { runProjection, type Scenario, type WithdrawalPlan, type YearBreakdown } from '@/core/projection';
import type { StateIncomeTaxLaw } from '@/core/tax/state';
import type { FilingStatus } from '@/core/types';
import {
  mapBasicFormToProjectionInputs,
  type BasicFormValues,
  type BasicHealthcarePhase,
  type BasicStarterStateCode,
} from '@/lib/basicFormMapping';
import { decodeScenario, type ScenarioHashPayload } from '@/lib/urlHash';
import { useScenariosStore } from '@/store/scenariosStore';

export const SCENARIO_STORAGE_KEY = 'fire-planner.scenario.v1';

export const STARTER_STATE_LAWS = Object.freeze({
  CA: CALIFORNIA_STATE_TAX,
  FL: FLORIDA_STATE_TAX,
  PA: PENNSYLVANIA_STATE_TAX,
} satisfies Record<BasicStarterStateCode, StateIncomeTaxLaw>);

export const DEFAULT_BASIC_FORM_VALUES = Object.freeze({
  currentYear: 2026,
  filingStatus: 'mfj',
  stateCode: 'CA',
  primaryAge: 55,
  partnerAge: 55,
  retirementYear: 2035,
  planEndAge: 95,
  annualSpendingToday: 100_000,
  annualW2Income: 0,
  annualConsultingIncome: 0,
  annualRentalIncome: 0,
  annualSocialSecurityBenefit: 0,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 0,
  brokerageAndCashBalance: 0,
  taxableBrokerageBasis: 0,
  traditionalBalance: 0,
  rothBalance: 0,
  healthcarePhase: 'none',
} satisfies BasicFormValues);

export type ScenarioStoreState = Readonly<{
  formValues: BasicFormValues;
  selectedStarterStateLaw: StateIncomeTaxLaw;
  scenario: Scenario;
  plan: WithdrawalPlan;
  customLaw: CustomLaw | undefined;
  customLawActive: boolean;
  projectionResults: readonly YearBreakdown[];
}>;

type ScenarioStoreActions = {
  setFormValues: (patch: Partial<BasicFormValues>) => void;
  replaceFormValues: (values: BasicFormValues) => void;
  setPlan: (plan: WithdrawalPlan) => void;
  setCustomLaw: (customLaw: CustomLaw | undefined) => void;
  resetScenario: () => void;
  hydrateFromUrlHash: (hash?: string) => boolean;
};

type ProjectionInputState = Readonly<{
  scenario: Scenario;
  plan: WithdrawalPlan;
  customLaw?: CustomLaw;
  customLawActive?: boolean;
}>;

type PersistedScenarioSnapshot = Readonly<{
  formValues: BasicFormValues;
  projectionInputs?: ProjectionInputState;
}>;

export const useScenarioStore = create<ScenarioStoreState & ScenarioStoreActions>((set) => ({
  ...readInitialScenarioState(),
  setFormValues: (patch) => {
    set((state) => persistAndMaybeSaveDefaultScenario(buildScenarioState({ ...state.formValues, ...patch })));
  },
  replaceFormValues: (values) => {
    set(persistAndMaybeSaveDefaultScenario(buildScenarioState(values)));
  },
  setPlan: (plan) => {
    set((state) =>
      persistAndMaybeSaveDefaultScenario(
        buildScenarioState(state.formValues, buildProjectionInputsWithPlan(state, plan)),
      ),
    );
  },
  setCustomLaw: (customLaw) => {
    set((state) =>
      persistScenarioState(
        buildScenarioState(state.formValues, {
          scenario: scenarioWithoutCustomLaw(state.scenario),
          plan: state.plan,
          ...(customLaw === undefined
            ? { customLawActive: false }
            : { customLaw, customLawActive: isCustomLawActive(customLaw) }),
        }),
      ),
    );
  },
  resetScenario: () => {
    set(persistScenarioState(buildScenarioState(DEFAULT_BASIC_FORM_VALUES)));
  },
  hydrateFromUrlHash: (hash) => {
    const nextState = buildScenarioStateFromHash(hash ?? getLocationHash());

    if (nextState === null) {
      return false;
    }

    set(persistScenarioState(nextState));
    return true;
  },
}));

function buildProjectionInputsWithPlan(state: ScenarioStoreState, plan: WithdrawalPlan): ProjectionInputState {
  const projectionInputs = {
    scenario: scenarioWithoutCustomLaw(state.scenario),
    plan,
    customLawActive: state.customLawActive,
  };

  return state.customLaw === undefined ? projectionInputs : { ...projectionInputs, customLaw: state.customLaw };
}

function readInitialScenarioState(): ScenarioStoreState {
  const hashState = buildScenarioStateFromHash(getLocationHash());

  if (hashState !== null) {
    return persistScenarioState(hashState);
  }

  const persisted = readPersistedScenarioSnapshot();

  if (persisted.projectionInputs !== undefined) {
    try {
      return buildScenarioState(persisted.formValues, persisted.projectionInputs);
    } catch {
      return buildScenarioState(persisted.formValues);
    }
  }

  return buildScenarioState(persisted.formValues);
}

function buildScenarioState(values: unknown, projectionInputs?: ProjectionInputState): ScenarioStoreState {
  const formValues = sanitizeBasicFormValues(values);
  const mappedInputs = projectionInputs ?? mapBasicFormToProjectionInputs(formValues);
  const customLaw = projectionInputs?.customLaw ?? projectionInputs?.scenario.customLaw;
  const customLawActive = projectionInputs?.customLawActive === true && isCustomLawActive(customLaw);
  const scenario =
    projectionInputs === undefined
      ? mappedInputs.scenario
      : scenarioWithCustomLawState(mappedInputs.scenario, customLaw, customLawActive);
  const { plan } = mappedInputs;
  const projectionResults = runProjection(scenario, plan);
  const state = {
    formValues,
    selectedStarterStateLaw: STARTER_STATE_LAWS[formValues.stateCode],
    scenario,
    plan,
    customLaw,
    customLawActive,
    projectionResults,
  };

  return state;
}

function buildScenarioStateFromHash(hash: string): ScenarioStoreState | null {
  const payload = decodeScenario(hash);

  if (payload === null) {
    return null;
  }

  try {
    const formValues = inferBasicFormValuesFromHashPayload(payload);

    return formValues === null ? null : buildScenarioState(formValues, payload);
  } catch {
    return null;
  }
}

function inferBasicFormValuesFromHashPayload(payload: ScenarioHashPayload): BasicFormValues | null {
  const startYear = finiteIntegerOrNull(payload.scenario.startYear);
  const endYear = finiteIntegerOrNull(payload.plan.endYear);

  if (startYear === null || endYear === null || endYear < startYear) {
    return null;
  }

  const primaryAge = DEFAULT_BASIC_FORM_VALUES.primaryAge;
  const retirementYear = inferRetirementYear(payload.scenario, startYear, endYear);
  const socialSecurityClaimYear = finiteIntegerOrNull(payload.scenario.socialSecurity?.claimYear);

  return {
    currentYear: startYear,
    filingStatus: isFilingStatus(payload.scenario.filingStatus)
      ? payload.scenario.filingStatus
      : DEFAULT_BASIC_FORM_VALUES.filingStatus,
    stateCode: stateCodeFromScenario(payload.scenario),
    primaryAge,
    partnerAge: partnerAgeFromScenario(payload.scenario, primaryAge),
    retirementYear,
    planEndAge: primaryAge + (endYear - startYear),
    annualSpendingToday:
      annualAmountForYear(payload.plan.annualSpending, startYear) ?? DEFAULT_BASIC_FORM_VALUES.annualSpendingToday,
    annualW2Income: annualAmountForYear(payload.scenario.w2Income, startYear) ?? DEFAULT_BASIC_FORM_VALUES.annualW2Income,
    annualConsultingIncome:
      annualAmountForYear(payload.scenario.consultingIncome, startYear) ??
      DEFAULT_BASIC_FORM_VALUES.annualConsultingIncome,
    annualRentalIncome:
      annualAmountForYear(payload.scenario.rentalIncome, startYear) ?? DEFAULT_BASIC_FORM_VALUES.annualRentalIncome,
    annualSocialSecurityBenefit: nonnegativeNumber(
      payload.scenario.socialSecurity?.annualBenefit,
      DEFAULT_BASIC_FORM_VALUES.annualSocialSecurityBenefit,
    ),
    socialSecurityClaimAge:
      socialSecurityClaimYear === null
        ? DEFAULT_BASIC_FORM_VALUES.socialSecurityClaimAge
        : primaryAge + (socialSecurityClaimYear - startYear),
    annualPensionOrAnnuityIncome:
      (annualAmountForYear(payload.scenario.pensionIncome, retirementYear) ?? 0) +
      (annualAmountForYear(payload.scenario.annuityIncome, retirementYear) ?? 0),
    brokerageAndCashBalance: nonnegativeNumber(
      payload.scenario.balances?.taxableBrokerage,
      DEFAULT_BASIC_FORM_VALUES.brokerageAndCashBalance,
    ),
    taxableBrokerageBasis: nonnegativeNumber(
      payload.scenario.basis?.taxableBrokerage,
      DEFAULT_BASIC_FORM_VALUES.taxableBrokerageBasis,
    ),
    traditionalBalance: nonnegativeNumber(
      payload.scenario.balances?.traditional,
      DEFAULT_BASIC_FORM_VALUES.traditionalBalance,
    ),
    rothBalance: nonnegativeNumber(payload.scenario.balances?.roth, DEFAULT_BASIC_FORM_VALUES.rothBalance),
    healthcarePhase: healthcarePhaseForYear(payload.scenario, startYear),
  };
}

function inferRetirementYear(scenario: Scenario, startYear: number, endYear: number): number {
  const activeIncomeYears = [...positiveAnnualYears(scenario.w2Income), ...positiveAnnualYears(scenario.consultingIncome)].filter(
    (year) => year >= startYear && year <= endYear,
  );

  if (activeIncomeYears.length > 0) {
    return Math.max(...activeIncomeYears) + 1;
  }

  const firstRetirementIncomeYear = firstPositiveAnnualYear([...scenario.pensionIncome, ...scenario.annuityIncome]);

  return firstRetirementIncomeYear ?? startYear;
}

function stateCodeFromScenario(scenario: Scenario): BasicStarterStateCode {
  const stateCode = scenario.state?.incomeTaxLaw?.stateCode;

  return isStarterStateCode(stateCode) ? stateCode : DEFAULT_BASIC_FORM_VALUES.stateCode;
}

function partnerAgeFromScenario(scenario: Scenario, primaryAge: number): number {
  if (scenario.filingStatus !== 'mfj') {
    return DEFAULT_BASIC_FORM_VALUES.partnerAge;
  }

  return scenario.partnerAge65Plus === true ? Math.max(65, primaryAge) : primaryAge;
}

function healthcarePhaseForYear(scenario: Scenario, year: number): BasicHealthcarePhase {
  const phase = scenario.healthcare.find((entry) => entry.year === year)?.kind;

  return isHealthcarePhase(phase) ? phase : DEFAULT_BASIC_FORM_VALUES.healthcarePhase;
}

function readPersistedScenarioSnapshot(): PersistedScenarioSnapshot {
  const storage = getLocalStorage();

  if (storage === null) {
    return { formValues: DEFAULT_BASIC_FORM_VALUES };
  }

  try {
    const raw = storage.getItem(SCENARIO_STORAGE_KEY);

    if (raw === null) {
      return { formValues: DEFAULT_BASIC_FORM_VALUES };
    }

    const parsed: unknown = JSON.parse(raw);
    const parsedRecord = isRecord(parsed) ? parsed : {};
    const stateRecord = isRecord(parsedRecord.state) ? parsedRecord.state : parsedRecord;
    const maybeFormValues = isRecord(stateRecord.formValues) ? stateRecord.formValues : parsedRecord;
    const formValues = sanitizeBasicFormValues(maybeFormValues);
    const projectionInputs = projectionInputsFromRecord(stateRecord);

    return projectionInputs === undefined ? { formValues } : { formValues, projectionInputs };
  } catch {
    return { formValues: DEFAULT_BASIC_FORM_VALUES };
  }
}

function persistScenarioState(state: ScenarioStoreState): ScenarioStoreState {
  const storage = getLocalStorage();

  if (storage !== null) {
    const persisted =
      state.customLaw === undefined
        ? {
            formValues: state.formValues,
            scenario: state.scenario,
            plan: state.plan,
            customLawActive: state.customLawActive,
          }
        : {
            formValues: state.formValues,
            scenario: state.scenario,
            plan: state.plan,
            customLaw: state.customLaw,
            customLawActive: state.customLawActive,
          };

    storage.setItem(
      SCENARIO_STORAGE_KEY,
      JSON.stringify(persisted),
    );
  }

  return state;
}

function persistAndMaybeSaveDefaultScenario(state: ScenarioStoreState): ScenarioStoreState {
  const persistedState = persistScenarioState(state);

  useScenariosStore.getState().saveDefaultScenarioOnce({
    scenario: persistedState.scenario,
    plan: persistedState.plan,
  });

  return persistedState;
}

function projectionInputsFromRecord(record: Record<string, unknown>): ProjectionInputState | undefined {
  if (!isRecord(record.scenario) || !isRecord(record.plan)) {
    return undefined;
  }

  const customLaw = customLawFromRecord(record, record.scenario);
  const customLawActive = record.customLawActive === true && isCustomLawActive(customLaw);
  const projectionInputs = {
    scenario: record.scenario as Scenario,
    plan: record.plan as WithdrawalPlan,
    customLawActive,
  };

  return customLaw === undefined ? projectionInputs : { ...projectionInputs, customLaw };
}

function customLawFromRecord(record: Record<string, unknown>, scenario: Record<string, unknown>): CustomLaw | undefined {
  if (isRecord(record.customLaw)) {
    return record.customLaw as CustomLaw;
  }

  if (isRecord(scenario.customLaw)) {
    return scenario.customLaw as CustomLaw;
  }

  return undefined;
}

function scenarioWithCustomLawState(
  scenario: Scenario,
  customLaw: CustomLaw | undefined,
  customLawActive: boolean,
): Scenario {
  const { customLaw: _ignoredCustomLaw, ...scenarioWithoutCustomLaw } = scenario;

  if (!customLawActive || customLaw === undefined) {
    return scenarioWithoutCustomLaw;
  }

  return {
    ...scenarioWithoutCustomLaw,
    customLaw,
  };
}

function scenarioWithoutCustomLaw(scenario: Scenario): Scenario {
  const { customLaw: _ignoredCustomLaw, ...scenarioWithoutOverride } = scenario;

  return scenarioWithoutOverride;
}

function sanitizeBasicFormValues(value: unknown): BasicFormValues {
  const candidate = isRecord(value) ? value : {};
  const primaryAge = boundedInteger(candidate.primaryAge, DEFAULT_BASIC_FORM_VALUES.primaryAge, 0, 120);
  const planEndAge = Math.max(primaryAge, boundedInteger(candidate.planEndAge, DEFAULT_BASIC_FORM_VALUES.planEndAge, 0, 120));

  return {
    currentYear: boundedInteger(candidate.currentYear, DEFAULT_BASIC_FORM_VALUES.currentYear, 1900, 2200),
    filingStatus: isFilingStatus(candidate.filingStatus) ? candidate.filingStatus : DEFAULT_BASIC_FORM_VALUES.filingStatus,
    stateCode: isStarterStateCode(candidate.stateCode) ? candidate.stateCode : DEFAULT_BASIC_FORM_VALUES.stateCode,
    primaryAge,
    partnerAge: boundedInteger(candidate.partnerAge, DEFAULT_BASIC_FORM_VALUES.partnerAge, 0, 120),
    retirementYear: boundedInteger(candidate.retirementYear, DEFAULT_BASIC_FORM_VALUES.retirementYear, 1900, 2300),
    planEndAge,
    annualSpendingToday: nonnegativeNumber(candidate.annualSpendingToday, DEFAULT_BASIC_FORM_VALUES.annualSpendingToday),
    annualW2Income: nonnegativeNumber(candidate.annualW2Income, DEFAULT_BASIC_FORM_VALUES.annualW2Income),
    annualConsultingIncome: nonnegativeNumber(
      candidate.annualConsultingIncome,
      DEFAULT_BASIC_FORM_VALUES.annualConsultingIncome,
    ),
    annualRentalIncome: nonnegativeNumber(candidate.annualRentalIncome, DEFAULT_BASIC_FORM_VALUES.annualRentalIncome),
    annualSocialSecurityBenefit: nonnegativeNumber(
      candidate.annualSocialSecurityBenefit,
      DEFAULT_BASIC_FORM_VALUES.annualSocialSecurityBenefit,
    ),
    socialSecurityClaimAge: boundedInteger(
      candidate.socialSecurityClaimAge,
      DEFAULT_BASIC_FORM_VALUES.socialSecurityClaimAge,
      0,
      120,
    ),
    annualPensionOrAnnuityIncome: nonnegativeNumber(
      candidate.annualPensionOrAnnuityIncome,
      DEFAULT_BASIC_FORM_VALUES.annualPensionOrAnnuityIncome,
    ),
    brokerageAndCashBalance: nonnegativeNumber(
      candidate.brokerageAndCashBalance,
      DEFAULT_BASIC_FORM_VALUES.brokerageAndCashBalance,
    ),
    taxableBrokerageBasis: nonnegativeNumber(
      candidate.taxableBrokerageBasis,
      DEFAULT_BASIC_FORM_VALUES.taxableBrokerageBasis,
    ),
    traditionalBalance: nonnegativeNumber(candidate.traditionalBalance, DEFAULT_BASIC_FORM_VALUES.traditionalBalance),
    rothBalance: nonnegativeNumber(candidate.rothBalance, DEFAULT_BASIC_FORM_VALUES.rothBalance),
    healthcarePhase: isHealthcarePhase(candidate.healthcarePhase)
      ? candidate.healthcarePhase
      : DEFAULT_BASIC_FORM_VALUES.healthcarePhase,
  };
}

function annualAmountForYear(entries: readonly { year: number; amount: number }[], year: number): number | null {
  const matchingEntry = entries.find((entry) => entry.year === year);

  return nonnegativeNumberOrNull(matchingEntry?.amount);
}

function positiveAnnualYears(entries: readonly { year: number; amount: number }[]): number[] {
  return entries.flatMap((entry) => (entry.amount > 0 ? [entry.year] : []));
}

function firstPositiveAnnualYear(entries: readonly { year: number; amount: number }[]): number | null {
  const sortedYears = positiveAnnualYears(entries).sort((left, right) => left - right);

  return sortedYears[0] ?? null;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const integer = finiteIntegerOrNull(value);

  if (integer === null || integer < min || integer > max) {
    return fallback;
  }

  return integer;
}

function finiteIntegerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;
}

function nonnegativeNumber(value: unknown, fallback: number): number {
  return nonnegativeNumberOrNull(value) ?? fallback;
}

function nonnegativeNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : null;
}

function isStarterStateCode(value: unknown): value is BasicStarterStateCode {
  return value === 'CA' || value === 'FL' || value === 'PA';
}

function isHealthcarePhase(value: unknown): value is BasicHealthcarePhase {
  return value === 'none' || value === 'aca' || value === 'medicare';
}

function isFilingStatus(value: unknown): value is FilingStatus {
  return value === 'single' || value === 'mfj' || value === 'hoh' || value === 'mfs';
}

function getLocationHash(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.hash;
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
