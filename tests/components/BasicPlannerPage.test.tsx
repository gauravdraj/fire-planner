import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { encodeScenario } from '@/lib/urlHash';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const STORED_FORM_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'single',
  stateCode: 'FL',
  primaryAge: 50,
  partnerAge: 50,
  retirementYear: 2030,
  planEndAge: 80,
  annualSpendingToday: 80_000,
  annualMortgagePAndI: 0,
  mortgagePayoffYear: 0,
  annualW2Income: 140_000,
  annualConsultingIncome: 0,
  annualRentalIncome: 0,
  annualSocialSecurityBenefit: 25_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 0,
  brokerageAndCashBalance: 300_000,
  taxableBrokerageBasis: 250_000,
  hsaBalance: 0,
  traditionalBalance: 500_000,
  rothBalance: 100_000,
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
  annualMortgagePAndI: 0,
  mortgagePayoffYear: 0,
  annualW2Income: 220_000,
  annualConsultingIncome: 20_000,
  annualRentalIncome: 12_000,
  annualSocialSecurityBenefit: 55_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 18_000,
  brokerageAndCashBalance: 950_000,
  taxableBrokerageBasis: 700_000,
  hsaBalance: 0,
  traditionalBalance: 1_200_000,
  rothBalance: 320_000,
  autoDepleteBrokerageEnabled: false,
  autoDepleteBrokerageYears: 10,
  autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
  expectedReturnTraditional: 0.05,
  expectedReturnRoth: 0.05,
  expectedReturnBrokerage: 0.05,
  expectedReturnHsa: 0.05,
  brokerageDividendYield: 0,
  brokerageQdiPercentage: 0.95,
  healthcarePhase: 'aca',
};

async function importBasicPlannerPage() {
  const [{ BasicPlannerPage }, { STARTER_TEMPLATES }, { DEFAULT_BASIC_FORM_VALUES, useScenarioStore }] = await Promise.all([
    import('@/components/BasicPlannerPage'),
    import('@/lib/starterTemplates'),
    import('@/store/scenarioStore'),
  ]);

  return { BasicPlannerPage, DEFAULT_BASIC_FORM_VALUES, STARTER_TEMPLATES, useScenarioStore };
}

function advanceLiveDebounce() {
  act(() => {
    vi.advanceTimersByTime(151);
  });
}

describe('BasicPlannerPage', () => {
  beforeEach(() => {
    vi.resetModules();
    installMemoryLocalStorage();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('smokes the live Basic Mode path without a run gate', async () => {
    vi.useFakeTimers();
    const { BasicPlannerPage, useScenarioStore } = await importBasicPlannerPage();

    render(<BasicPlannerPage />);

    expect(screen.getByRole('form', { name: /basic scenario form/i })).toBeInTheDocument();
    expect(screen.queryByText(/run projection/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run projection/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Projection results will appear here/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Run the projection to see/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/live projection stats/i)).toHaveClass('sticky');
    expect(screen.queryByRole('heading', { name: /projection summary/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('live-stat-net-worth-at-retirement')).toHaveTextContent('Net worth at retirement');
    expect(screen.getByTestId('live-stat-plan-end-balance')).toHaveTextContent('Plan-end balance');
    expect(screen.getByTestId('live-stat-years-funded')).toHaveTextContent('Years funded');
    expect(screen.getByRole('heading', { name: /year-by-year projection/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /72\(t\) SEPP IRA size calculator/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/72\(t\) calculator inputs/i)).toBeInTheDocument();
    expect(screen.getByText('Fixed Amortization Method. Independent of your scenario above.')).toBeInTheDocument();
    expect(screen.getByText('$803,990.37')).toBeInTheDocument();

    const averageMagiStat = screen.getByTestId('live-stat-average-bridge-magi');
    const initialAverageMagi = liveStatValue(averageMagiStat);
    fireEvent.change(screen.getByLabelText('Pension/annuity annual amount'), { target: { value: '50000' } });
    advanceLiveDebounce();

    expect(useScenarioStore.getState().formValues.annualPensionOrAnnuityIncome).toBe(50_000);
    expect(liveStatValue(averageMagiStat)).not.toBe(initialAverageMagi);

    const scenarioFormValues = useScenarioStore.getState().formValues;
    fireEvent.change(screen.getByLabelText('Desired annual income'), { target: { value: '60000' } });
    advanceLiveDebounce();

    expect(useScenarioStore.getState().formValues).toEqual(scenarioFormValues);
    expect(useScenarioStore.getState()).not.toHaveProperty('hasRunProjection');
  });

  it('loads starter templates through the scenario store and refreshes visible form values', async () => {
    vi.useFakeTimers();
    const { BasicPlannerPage, DEFAULT_BASIC_FORM_VALUES, STARTER_TEMPLATES, useScenarioStore } =
      await importBasicPlannerPage();

    render(<BasicPlannerPage />);

    expect(screen.getByRole('heading', { name: /try a sample scenario/i })).toBeInTheDocument();
    const explanation = screen.getByText(/These examples show two common FIRE bridge strategies/i);
    expect(explanation).toHaveTextContent(/update the projection instantly/i);
    expect(explanation).toHaveTextContent(/72\(t\) context scenario/i);
    expect(explanation).toHaveTextContent(/Roth ladder scenario/i);
    expect(explanation.tagName).toBe('P');

    const initialProjectionResults = useScenarioStore.getState().projectionResults;
    const brokerageBridgeTemplate = STARTER_TEMPLATES[0];
    fireEvent.click(screen.getByRole('button', { name: /brokerage bridge with 72\(t\) context/i }));

    expect(useScenarioStore.getState().formValues).toEqual({
      ...DEFAULT_BASIC_FORM_VALUES,
      ...brokerageBridgeTemplate.formValues,
    });
    expect(useScenarioStore.getState().projectionResults).not.toBe(initialProjectionResults);
    expect(screen.getByLabelText('State')).toHaveValue(brokerageBridgeTemplate.formValues.stateCode);
    expect(screen.getByLabelText('Annual spending')).toHaveValue(
      String(brokerageBridgeTemplate.formValues.annualSpendingToday),
    );
    expect(screen.getByLabelText('Auto-deplete brokerage')).toBeChecked();
    expect(
      screen.getByText(`Loaded '${brokerageBridgeTemplate.label}' — change any field to customize.`),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(
      screen.queryByText(`Loaded '${brokerageBridgeTemplate.label}' — change any field to customize.`),
    ).not.toBeInTheDocument();

    const rothLadderTemplate = STARTER_TEMPLATES[1];
    fireEvent.click(screen.getByRole('button', { name: /roth ladder bridge/i }));

    expect(useScenarioStore.getState().formValues).toEqual({
      ...DEFAULT_BASIC_FORM_VALUES,
      ...rothLadderTemplate.formValues,
    });
    expect(screen.getByLabelText('State')).toHaveValue(rothLadderTemplate.formValues.stateCode);
    expect(screen.getByLabelText('Annual mortgage P&I')).toHaveValue(
      String(rothLadderTemplate.formValues.annualMortgagePAndI),
    );
    expect(screen.getByText(`Loaded '${rothLadderTemplate.label}' — change any field to customize.`)).toBeInTheDocument();
  });

  it('cleans up starter template confirmation timers on unmount', async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { BasicPlannerPage } = await importBasicPlannerPage();

    const { unmount } = render(<BasicPlannerPage />);
    fireEvent.click(screen.getByRole('button', { name: /brokerage bridge with 72\(t\) context/i }));

    expect(screen.getByText(/change any field to customize/i)).toBeInTheDocument();

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('hydrates a valid URL hash before localStorage and renders dependent outputs', async () => {
    window.localStorage.setItem(
      'fire-planner.scenario.v1',
      JSON.stringify({
        formValues: STORED_FORM_VALUES,
      }),
    );
    window.location.hash = encodeScenario(mapBasicFormToProjectionInputs(HASH_FORM_VALUES));

    const { BasicPlannerPage, useScenarioStore } = await importBasicPlannerPage();

    render(<BasicPlannerPage />);

    expect(useScenarioStore.getState().formValues.stateCode).toBe('PA');
    expect(useScenarioStore.getState()).not.toHaveProperty('hasRunProjection');
    expect(screen.getByLabelText('State')).toHaveValue('PA');
    expect(screen.queryByRole('heading', { name: /projection summary/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/live projection stats/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /year-by-year projection/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /account balances/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /magi thresholds/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tax breakdown/i })).toBeInTheDocument();
  });

  it('ignores malformed URL hashes without crashing and still renders stored results', async () => {
    window.localStorage.setItem(
      'fire-planner.scenario.v1',
      JSON.stringify({
        formValues: STORED_FORM_VALUES,
      }),
    );
    window.location.hash = '#v1:not-valid-compressed-data';

    const { BasicPlannerPage, useScenarioStore } = await importBasicPlannerPage();

    render(<BasicPlannerPage />);

    expect(useScenarioStore.getState().formValues.stateCode).toBe('FL');
    expect(useScenarioStore.getState()).not.toHaveProperty('hasRunProjection');
    expect(screen.getByLabelText('State')).toHaveValue('FL');
    expect(screen.queryByText(/Projection results will appear here/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /projection summary/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/live projection stats/i)).toBeInTheDocument();
  });
});

function liveStatValue(stat: HTMLElement): string | null {
  return stat.querySelector('.tabular-nums')?.textContent ?? null;
}
