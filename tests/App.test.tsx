import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App, CUSTOM_LAW_BANNER_TEXT } from '@/App';
import { DISCLAIMER_TEXT } from '@/components/Disclaimer';
import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { useScenarioStore } from '@/store/scenarioStore';
import { useScenariosStore } from '@/store/scenariosStore';
import { UI_STORAGE_KEY, useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from './store/memoryStorage';

const BASE_FORM_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'single',
  stateCode: 'FL',
  primaryAge: 52,
  partnerAge: 52,
  retirementYear: 2030,
  planEndAge: 70,
  annualSpendingToday: 80_000,
  annualMortgagePAndI: 0,
  mortgagePayoffYear: 0,
  annualW2Income: 150_000,
  annualConsultingIncome: 0,
  annualRentalIncome: 0,
  annualSocialSecurityBenefit: 24_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 0,
  brokerageAndCashBalance: 400_000,
  taxableBrokerageBasis: 300_000,
  hsaBalance: 0,
  traditionalBalance: 600_000,
  rothBalance: 125_000,
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

describe('App', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
    useScenariosStore.setState({ scenarios: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the shell in disclaimer, header, main, footer order when tax data is fresh', () => {
    const { container } = render(<App />);
    const shell = container.firstElementChild;

    expect(shell?.children).toHaveLength(4);
    expect(shell?.children[0]).toHaveTextContent(DISCLAIMER_TEXT);
    expect(shell?.children[1]?.tagName).toBe('HEADER');
    expect(shell?.children[2]?.tagName).toBe('MAIN');
    expect(shell?.children[3]?.tagName).toBe('FOOTER');
    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fire Planner' })).toBeInTheDocument();
    expect(screen.getByText('All inputs stay on your device.')).toBeInTheDocument();
  });

  it('persists mode changes and renders only the advanced Gate 4 shell', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

    expect(screen.getByRole('heading', { name: 'Advanced planner' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Custom law' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Manual plan' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Planner controls' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Planning charts' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Scenarios' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Basic planner' })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({ mode: 'advanced' });
  });

  it('routes to compare as a top-level view without a router dependency', () => {
    saveNamedScenario('Baseline', BASE_FORM_VALUES);
    saveNamedScenario('Harvest plan', {
      ...BASE_FORM_VALUES,
      annualSpendingToday: 95_000,
      brokerageAndCashBalance: 650_000,
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByRole('heading', { name: 'Compare two scenarios' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scenario summaries' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Basic planner' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Advanced planner' })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({ mode: 'compare' });
  });

  it('launches compare from the advanced scenario manager', () => {
    const first = saveNamedScenario('Baseline', BASE_FORM_VALUES);
    const second = saveNamedScenario('Harvest plan', {
      ...BASE_FORM_VALUES,
      annualSpendingToday: 95_000,
      brokerageAndCashBalance: 650_000,
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Scenarios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage scenarios' }));
    fireEvent.click(screen.getByLabelText('Select Baseline for comparison'));
    fireEvent.click(screen.getByLabelText('Select Harvest plan for comparison'));
    fireEvent.click(screen.getByRole('button', { name: 'Compare selected scenarios' }));

    expect(useUiStore.getState().mode).toBe('compare');
    expect(screen.getByRole('heading', { name: 'Compare two scenarios' })).toBeInTheDocument();
    expect(screen.getByLabelText('First saved scenario')).toHaveValue(first.id);
    expect(screen.getByLabelText('Second saved scenario')).toHaveValue(second.id);
    expect(screen.queryByRole('heading', { name: 'Advanced planner' })).not.toBeInTheDocument();
  });

  it('keeps basic mode unchanged by default', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Basic planner' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: /basic scenario form/i })).toBeInTheDocument();
    expect(screen.queryByText(CUSTOM_LAW_BANNER_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Advanced planner' })).not.toBeInTheDocument();
  });

  it('shows the custom-law banner across mode switches and hides it after reset all', () => {
    useScenarioStore.getState().setCustomLaw({
      federal: {
        standardDeduction: {
          single: 20_000,
        },
      },
    });

    render(<App />);

    expect(screen.getByText(CUSTOM_LAW_BANNER_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic planner' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

    expect(screen.getByText(CUSTOM_LAW_BANNER_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Advanced planner' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset all custom-law overrides' }));

    expect(screen.queryByText(CUSTOM_LAW_BANNER_TEXT)).not.toBeInTheDocument();
    expect(useScenarioStore.getState().customLaw).toBeUndefined();
    expect(useScenarioStore.getState().customLawActive).toBe(false);
  });

  it('persists display unit changes without changing planner mode', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Nominal dollars' }));

    expect(useUiStore.getState().mode).toBe('basic');
    expect(useUiStore.getState().displayUnit).toBe('nominal');
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({
      displayUnit: 'nominal',
      mode: 'basic',
    });
  });
});

function saveNamedScenario(name: string, values: BasicFormValues) {
  const { plan, scenario } = mapBasicFormToProjectionInputs(values);

  return useScenariosStore.getState().save({ name, plan, scenario });
}
