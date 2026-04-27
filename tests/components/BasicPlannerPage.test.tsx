import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('BasicPlannerPage', () => {
  beforeEach(() => {
    vi.resetModules();
    installMemoryLocalStorage();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the form with a minimal empty state before the first projection run', async () => {
    const { BasicPlannerPage, useScenarioStore } = await importBasicPlannerPage();

    render(<BasicPlannerPage />);

    expect(screen.getByRole('form', { name: /basic scenario form/i })).toBeInTheDocument();
    expect(screen.getByText('Projection results will appear here after you run the scenario.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /projection summary/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /year-by-year projection/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /account balances/i })).not.toBeInTheDocument();
    expect(useScenarioStore.getState().hasRunProjection).toBe(false);
  });

  it('renders summary cards, table, and chart after Run projection', async () => {
    const { BasicPlannerPage, useScenarioStore } = await importBasicPlannerPage();

    render(<BasicPlannerPage />);
    fireEvent.click(screen.getByRole('button', { name: /run projection/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Scenario updated.');
    expect(screen.queryByText('Projection results will appear here after you run the scenario.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /projection summary/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /year-by-year projection/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /account balances/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /stacked account balances/i })).toBeInTheDocument();
    expect(screen.getByText('Net worth at retirement').nextElementSibling).toHaveClass('tabular-nums');
    expect(useScenarioStore.getState().hasRunProjection).toBe(true);
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
    expect(useScenarioStore.getState().hasRunProjection).toBe(true);
    expect(screen.getByLabelText('State')).toHaveValue('PA');
    expect(screen.getByRole('heading', { name: /projection summary/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /year-by-year projection/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /account balances/i })).toBeInTheDocument();
  });

  it('ignores malformed URL hashes without crashing and keeps the page empty before run', async () => {
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
    expect(useScenarioStore.getState().hasRunProjection).toBe(false);
    expect(screen.getByLabelText('State')).toHaveValue('FL');
    expect(screen.getByText('Projection results will appear here after you run the scenario.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /projection summary/i })).not.toBeInTheDocument();
  });
});
