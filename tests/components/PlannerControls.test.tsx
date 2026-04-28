import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AdvancedView } from '@/components/advanced/AdvancedView';
import { DEFAULT_BASIC_FORM_VALUES, useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

describe('advanced planner controls', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
    useUiStore.getState().setMode('advanced');
  });

  afterEach(() => {
    cleanup();
  });

  it('edits and clears manual plan fields while rerunning projection', () => {
    useScenarioStore.getState().replaceFormValues({
      ...DEFAULT_BASIC_FORM_VALUES,
      planEndAge: 56,
      annualSpendingToday: 0,
      brokerageAndCashBalance: 100_000,
      taxableBrokerageBasis: 50_000,
      traditionalBalance: 50_000,
    });

    render(<AdvancedView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Manual plan' }));

    fireEvent.change(screen.getByLabelText('Spending 2026'), { target: { value: '120000' } });
    fireEvent.change(screen.getByLabelText('Roth conversion 2026'), { target: { value: '15000' } });
    fireEvent.change(screen.getByLabelText('Brokerage harvest 2026'), { target: { value: '2500' } });

    const stateAfterEdit = useScenarioStore.getState();
    expect(stateAfterEdit.plan.annualSpending).toContainEqual({ year: 2026, amount: 120_000 });
    expect(stateAfterEdit.plan.rothConversions).toContainEqual({ year: 2026, amount: 15_000 });
    expect(stateAfterEdit.plan.brokerageHarvests).toContainEqual({ year: 2026, amount: 2_500 });
    expect(stateAfterEdit.projectionResults[0]?.spending).toBe(120_000);
    expect(stateAfterEdit.projectionResults[0]?.conversions).toBe(15_000);
    expect(stateAfterEdit).not.toHaveProperty('hasRunProjection');

    fireEvent.click(screen.getByRole('tab', { name: 'Planning charts' }));

    expect(screen.queryByRole('heading', { name: 'Projection summary' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Year-by-year projection' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Account balances' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'MAGI thresholds' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tax breakdown' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '2026' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Manual plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear 2026' }));

    const stateAfterClear = useScenarioStore.getState();
    expect(stateAfterClear.plan.annualSpending.some((entry) => entry.year === 2026)).toBe(false);
    expect(stateAfterClear.plan.rothConversions?.some((entry) => entry.year === 2026) ?? false).toBe(false);
    expect(stateAfterClear.plan.brokerageHarvests?.some((entry) => entry.year === 2026) ?? false).toBe(false);
    expect(screen.getByLabelText('Spending 2026')).toHaveValue(null);
  });

  it('generates Roth ladder conversions for the selected constraint and default claim-year range', () => {
    useScenarioStore.getState().replaceFormValues({
      ...DEFAULT_BASIC_FORM_VALUES,
      annualSpendingToday: 0,
      annualSocialSecurityBenefit: 30_000,
      brokerageAndCashBalance: 0,
      traditionalBalance: 250_000,
    });

    render(<AdvancedView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Planner controls' }));

    expect(screen.getByLabelText('Roth start year')).toHaveValue(2026);
    expect(screen.getByLabelText('Roth end year')).toHaveValue(2038);
    expect(screen.getByText(/IRMAA T\+2:/)).toBeInTheDocument();
    expect(screen.queryByTitle('Year T IRMAA MAGI drives the year T+2 Medicare premium bill.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Binding constraint'), { target: { value: 'irmaaTier' } });
    expect(screen.getByLabelText('Maximum IRMAA tier')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Binding constraint'), { target: { value: 'acaFplPercentage' } });
    expect(screen.getByLabelText('Maximum ACA FPL multiple')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Binding constraint'), { target: { value: 'ltcgBracket' } });
    expect(screen.getByLabelText('LTCG bracket ceiling')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Binding constraint'), { target: { value: 'federalBracket' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Roth ladder plan' }));

    const state = useScenarioStore.getState();
    expect(state.plan.rothConversions?.[0]?.year).toBe(2026);
    expect(state.plan.rothConversions?.[0]?.amount ?? 0).toBeGreaterThan(0);
    expect(state.projectionResults[0]?.conversions ?? 0).toBeGreaterThan(0);
    expect(screen.getByText(/Generated Roth ladder actions for/i)).toBeInTheDocument();
    expect(screen.getAllByText(/premium bill/i).length).toBeGreaterThan(0);
  });

  it('generates capped LTCG harvests with optional ACA and IRMAA guard controls', () => {
    useScenarioStore.getState().replaceFormValues({
      ...DEFAULT_BASIC_FORM_VALUES,
      planEndAge: 60,
      annualSpendingToday: 0,
      brokerageAndCashBalance: 200_000,
      taxableBrokerageBasis: 100_000,
      healthcarePhase: 'aca',
    });

    render(<AdvancedView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Planner controls' }));

    expect(screen.getByLabelText('LTCG start year')).toHaveValue(2026);
    expect(screen.getByLabelText('LTCG end year')).toHaveValue(2031);

    fireEvent.change(screen.getByLabelText('Max harvest per year'), { target: { value: '10000' } });
    fireEvent.click(screen.getByLabelText('Apply ACA FPL guard'));
    fireEvent.change(screen.getByLabelText('Maximum ACA FPL multiple'), { target: { value: '4' } });
    fireEvent.click(screen.getByLabelText('Apply IRMAA guard'));
    expect(screen.getByLabelText('Maximum IRMAA tier')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate LTCG harvest plan' }));

    const state = useScenarioStore.getState();
    expect(state.plan.brokerageHarvests?.[0]).toEqual({ year: 2026, amount: 10_000 });
    expect(state.projectionResults[0]?.brokerageHarvests).toBe(10_000);
    expect(screen.getByText(/Generated LTCG harvest actions for/i)).toBeInTheDocument();
    expect(screen.getAllByText('limited by max harvest').length).toBeGreaterThan(0);
  });
});
