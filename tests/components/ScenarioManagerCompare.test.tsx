import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompareView } from '@/components/compare/CompareView';
import { ScenarioManager } from '@/components/scenarios/ScenarioManager';
import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { useScenarioStore } from '@/store/scenarioStore';
import { SCENARIOS_STORAGE_KEY, useScenariosStore } from '@/store/scenariosStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const BASE_FORM_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'single',
  stateCode: 'FL',
  primaryAge: 52,
  partnerAge: 52,
  retirementYear: 2030,
  planEndAge: 70,
  annualSpendingToday: 80_000,
  inflationRate: 0.025,
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

const ALTERNATE_FORM_VALUES: BasicFormValues = {
  ...BASE_FORM_VALUES,
  annualSpendingToday: 95_000,
  brokerageAndCashBalance: 650_000,
  traditionalBalance: 450_000,
};

describe('scenario manager and compare view', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
    useScenariosStore.setState({ scenarios: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('saves, renames, duplicates, and deletes local named scenarios', () => {
    useScenarioStore.getState().replaceFormValues(BASE_FORM_VALUES);

    render(<ScenarioManager />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage scenarios' }));
    fireEvent.change(screen.getByLabelText('Save active scenario as'), { target: { value: 'Baseline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as' }));

    expect(screen.getByLabelText('Select Baseline for comparison')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(SCENARIOS_STORAGE_KEY) ?? '[]')).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Baseline' })]),
    );
    expect(window.localStorage.getItem('fire-planner.scenario.v1')).not.toContain('Baseline');

    const baselineRow = screen.getByLabelText('Select Baseline for comparison').closest('li');
    expect(baselineRow).not.toBeNull();

    act(() => {
      useScenarioStore.getState().replaceFormValues(ALTERNATE_FORM_VALUES);
    });
    fireEvent.click(within(baselineRow as HTMLElement).getByRole('button', { name: 'Update snapshot' }));

    const updatedBaseline = useScenariosStore.getState().list().find((scenario) => scenario.name === 'Baseline');
    expect(updatedBaseline?.scenario.balances).toMatchObject({
      taxableBrokerage: ALTERNATE_FORM_VALUES.brokerageAndCashBalance,
      traditional: ALTERNATE_FORM_VALUES.traditionalBalance,
    });

    fireEvent.change(screen.getByLabelText('Rename Baseline'), { target: { value: 'Optimized' } });
    fireEvent.click(within(baselineRow as HTMLElement).getByRole('button', { name: 'Rename' }));

    expect(screen.getByLabelText('Select Optimized for comparison')).toBeInTheDocument();

    const optimizedRow = screen.getByLabelText('Select Optimized for comparison').closest('li');
    expect(optimizedRow).not.toBeNull();
    fireEvent.click(within(optimizedRow as HTMLElement).getByRole('button', { name: 'Duplicate' }));

    expect(screen.getByLabelText('Select Optimized copy for comparison')).toBeInTheDocument();

    const copyRow = screen.getByLabelText('Select Optimized copy for comparison').closest('li');
    expect(copyRow).not.toBeNull();
    fireEvent.click(within(copyRow as HTMLElement).getByRole('button', { name: 'Delete' }));

    expect(screen.queryByLabelText('Select Optimized copy for comparison')).not.toBeInTheDocument();
    expect(useScenariosStore.getState().list().map((scenario) => scenario.name)).toEqual(
      expect.arrayContaining(['Default scenario', 'Optimized']),
    );
  });

  it('closes on Escape, restores focus, and launches comparison for exactly two selections', async () => {
    const first = saveNamedScenario('Baseline', BASE_FORM_VALUES);
    const second = saveNamedScenario('Harvest plan', ALTERNATE_FORM_VALUES);
    saveNamedScenario('Conservative', { ...BASE_FORM_VALUES, annualSpendingToday: 70_000 });
    const onCompare = vi.fn();

    render(<ScenarioManager onCompare={onCompare} />);

    const trigger = screen.getByRole('button', { name: 'Manage scenarios' });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Manage saved scenarios' });
    expect(screen.getByLabelText('Save active scenario as')).toHaveFocus();
    expect(dialog.firstElementChild).toHaveClass('lg:max-w-6xl', 'xl:max-w-7xl');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Manage saved scenarios' })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    fireEvent.click(screen.getByLabelText('Select Baseline for comparison'));
    fireEvent.click(screen.getByLabelText('Select Harvest plan for comparison'));

    expect(screen.getByText('Ready to compare')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Conservative for comparison')).toBeDisabled();
    expect(screen.getByText('Two scenarios are already selected. Clear one before adding this scenario.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Compare selected scenarios' }));

    expect(onCompare).toHaveBeenCalledWith([first.id, second.id]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Manage saved scenarios' })).not.toBeInTheDocument());
  });

  it('renders exactly-two saved scenario comparison with summaries, annual data, MAGI overlay, and tax breakdown', async () => {
    const first = saveNamedScenario('Baseline', BASE_FORM_VALUES);
    const second = saveNamedScenario('Harvest plan', ALTERNATE_FORM_VALUES);

    render(<CompareView />);

    expect(await screen.findByRole('heading', { name: 'Scenario summaries' })).toBeInTheDocument();
    expect(screen.getByLabelText('First saved scenario')).toHaveValue(first.id);
    expect(screen.getByLabelText('Second saved scenario')).toHaveValue(second.id);
    expect(screen.getByRole('heading', { name: 'Combined year-by-year data' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Two-scenario MAGI overlay' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tax breakdown comparison' })).toBeInTheDocument();
    expect(screen.getAllByText('Baseline').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Harvest plan').length).toBeGreaterThan(0);
    expect(screen.getByText('ACA premium credit')).toBeInTheDocument();
    expect(screen.getByText('Exactly two scenarios selected')).toBeInTheDocument();

    const firstMagiGroup = screen.getByRole('group', { name: 'MAGI series for Baseline' });
    const acaMagiButton = within(firstMagiGroup).getByRole('button', { name: 'ACA MAGI' });
    const irmaaMagiButton = within(firstMagiGroup).getByRole('button', { name: 'IRMAA MAGI' });

    expect(acaMagiButton).toHaveAttribute('aria-pressed', 'true');
    expect(irmaaMagiButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(irmaaMagiButton);

    expect(acaMagiButton).toHaveAttribute('aria-pressed', 'false');
    expect(irmaaMagiButton).toHaveAttribute('aria-pressed', 'true');
  });
});

function saveNamedScenario(name: string, values: BasicFormValues) {
  const { plan, scenario } = mapBasicFormToProjectionInputs(values);

  return useScenariosStore.getState().save({ name, plan, scenario });
}
