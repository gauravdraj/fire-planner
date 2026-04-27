import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App, CUSTOM_LAW_BANNER_TEXT } from '@/App';
import type { WithdrawalPlan } from '@/core/projection';
import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { DEFAULT_BASIC_FORM_VALUES, useScenarioStore } from '@/store/scenarioStore';
import { SCENARIOS_STORAGE_KEY, useScenariosStore } from '@/store/scenariosStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const OPERATOR_BASE_VALUES: BasicFormValues = {
  ...DEFAULT_BASIC_FORM_VALUES,
  filingStatus: 'single',
  stateCode: 'FL',
  primaryAge: 55,
  partnerAge: 55,
  retirementYear: 2026,
  planEndAge: 70,
  annualSpendingToday: 70_000,
  annualW2Income: 0,
  annualConsultingIncome: 0,
  annualRentalIncome: 0,
  annualSocialSecurityBenefit: 30_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 0,
  brokerageAndCashBalance: 300_000,
  taxableBrokerageBasis: 250_000,
  traditionalBalance: 800_000,
  rothBalance: 100_000,
  healthcarePhase: 'aca',
};

describe('advanced Gate 4 app flow', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
    useScenariosStore.setState({ scenarios: [] });
    window.history.replaceState(null, '', '/planner?case=gate4');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the custom-law banner only after an explicit saved edit', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Basic planner' })).toBeInTheDocument();
    expect(screen.queryByText(CUSTOM_LAW_BANNER_TEXT)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.change(screen.getByLabelText('Married filing jointly'), { target: { value: '35000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save custom law edits' }));

    expect(screen.getByText('Custom-law edits saved.')).toBeInTheDocument();
    expect(screen.getByText(CUSTOM_LAW_BANNER_TEXT)).toBeInTheDocument();
    expect(useScenarioStore.getState().customLaw).toEqual({
      federal: {
        standardDeduction: {
          mfj: 35_000,
        },
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Basic' }));

    expect(screen.getByRole('heading', { name: 'Basic planner' })).toBeInTheDocument();
    expect(screen.getByText(CUSTOM_LAW_BANNER_TEXT)).toBeInTheDocument();
  });

  it('generates Roth ladder conversions into the manual plan table and projection UI', () => {
    useScenarioStore.getState().replaceFormValues({
      ...OPERATOR_BASE_VALUES,
      annualSpendingToday: 0,
      brokerageAndCashBalance: 0,
      taxableBrokerageBasis: 0,
      traditionalBalance: 250_000,
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Planner controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate Roth ladder plan' }));

    const generatedConversion = useScenarioStore.getState().plan.rothConversions?.[0];
    expect(generatedConversion?.year).toBe(2026);
    expect(generatedConversion?.amount ?? 0).toBeGreaterThan(0);
    expect(useScenarioStore.getState().projectionResults[0]?.conversions).toBe(generatedConversion?.amount);
    expect(screen.getByText(/Generated Roth ladder actions for/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Manual plan' }));

    expect(screen.getByLabelText('Roth conversion 2026')).toHaveValue(generatedConversion?.amount);

    fireEvent.click(screen.getByRole('tab', { name: 'Planning charts' }));

    const projectedAgi = useScenarioStore.getState().projectionResults[0]?.agi ?? 0;
    const projectionRow = screen.getByRole('rowheader', { name: '2026' }).closest('tr');

    expect(screen.getByRole('heading', { name: 'Year-by-year projection' })).toBeInTheDocument();
    expect(projectionRow).not.toBeNull();
    expect(within(projectionRow as HTMLElement).getByText(formatMoney(projectedAgi))).toBeInTheDocument();
  });

  it('saves Conservative, duplicates it, and edits the duplicate spending plan', () => {
    useScenarioStore.getState().replaceFormValues(OPERATOR_BASE_VALUES);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Scenarios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage scenarios' }));
    fireEvent.change(screen.getByLabelText('Save active scenario as'), { target: { value: 'Conservative' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as' }));

    expect(screen.getByLabelText('Select Conservative for comparison')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(SCENARIOS_STORAGE_KEY) ?? '[]')).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Conservative' })]),
    );

    const conservativeRow = screen.getByLabelText('Select Conservative for comparison').closest('li');
    expect(conservativeRow).not.toBeNull();
    fireEvent.click(within(conservativeRow as HTMLElement).getByRole('button', { name: 'Duplicate' }));

    expect(screen.getByLabelText('Select Conservative copy for comparison')).toBeInTheDocument();

    const conservative = savedScenarioNamed('Conservative');
    const duplicate = savedScenarioNamed('Conservative copy');
    const editedDuplicatePlan = withSpendingOverride(duplicate.plan, duplicate.scenario.startYear, 90_000);

    useScenariosStore.getState().save({
      id: duplicate.id,
      name: duplicate.name,
      plan: editedDuplicatePlan,
      scenario: duplicate.scenario,
    });

    expect(spendingForYear(conservative.plan, conservative.scenario.startYear)).toBe(70_000);
    expect(spendingForYear(savedScenarioNamed('Conservative copy').plan, duplicate.scenario.startYear)).toBe(90_000);
  });

  it('renders two saved scenarios side-by-side in compare view', () => {
    const conservative = saveNamedScenario('Conservative', OPERATOR_BASE_VALUES);
    const higherSpending = saveNamedScenario('Conservative copy', {
      ...OPERATOR_BASE_VALUES,
      annualSpendingToday: 90_000,
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByRole('heading', { name: 'Compare two scenarios' })).toBeInTheDocument();
    expect(screen.getByLabelText('First saved scenario')).toHaveValue(conservative.id);
    expect(screen.getByLabelText('Second saved scenario')).toHaveValue(higherSpending.id);

    const summaries = screen.getByRole('heading', { name: 'Scenario summaries' }).closest('section');
    expect(summaries).not.toBeNull();
    expect(within(summaries as HTMLElement).getByRole('heading', { name: 'Conservative' })).toBeInTheDocument();
    expect(within(summaries as HTMLElement).getByRole('heading', { name: 'Conservative copy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Combined year-by-year data' })).toBeInTheDocument();
  });
});

function saveNamedScenario(name: string, values: BasicFormValues) {
  const { plan, scenario } = mapBasicFormToProjectionInputs(values);

  return useScenariosStore.getState().save({ name, plan, scenario });
}

function savedScenarioNamed(name: string) {
  const savedScenario = useScenariosStore.getState().list().find((scenario) => scenario.name === name);

  if (savedScenario === undefined || savedScenario.plan === undefined) {
    throw new Error(`Expected saved scenario ${name} with a plan.`);
  }

  return { ...savedScenario, plan: savedScenario.plan };
}

function withSpendingOverride(plan: WithdrawalPlan, year: number, amount: number): WithdrawalPlan {
  return {
    ...plan,
    annualSpending: [
      ...plan.annualSpending.filter((entry) => entry.year !== year),
      {
        year,
        amount,
      },
    ].sort((left, right) => left.year - right.year),
  };
}

function spendingForYear(plan: WithdrawalPlan, year: number): number | undefined {
  return plan.annualSpending.find((entry) => entry.year === year)?.amount;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount);
}
