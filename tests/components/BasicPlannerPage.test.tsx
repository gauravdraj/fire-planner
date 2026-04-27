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

async function importBasicPlannerPage() {
  const [{ BasicPlannerPage }, { useScenarioStore }] = await Promise.all([
    import('@/components/BasicPlannerPage'),
    import('@/store/scenarioStore'),
  ]);

  return { BasicPlannerPage, useScenarioStore };
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
