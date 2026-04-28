import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BasicForm } from '@/components/BasicForm';
import { useScenarioStore } from '@/store/scenarioStore';

import { installMemoryLocalStorage } from '../../tests/store/memoryStorage';

function renderVerdictForm() {
  render(<BasicForm layout="verdict" />);
}

function advanceLiveDebounce() {
  act(() => {
    vi.advanceTimersByTime(151);
  });
}

describe('BasicForm verdict layout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installMemoryLocalStorage();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the first-class verdict controls and hides disclosure-only fields while collapsed', () => {
    renderVerdictForm();

    expect(screen.getByRole('form', { name: /basic scenario form/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /plan basics/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Filing status')).toHaveValue('mfj');
    expect(screen.getByLabelText('State')).toHaveValue('CA');
    expect(screen.getByLabelText('Primary age')).toHaveValue('55');
    expect(screen.getByLabelText('Partner age')).toHaveValue('55');
    expect(screen.getByLabelText('Retirement target year')).toHaveValue('2029');
    expect(screen.getByLabelText('Annual spending')).toHaveValue('220000');
    expect(screen.getByLabelText('W-2 income')).toHaveValue('550000');
    expect(screen.getByLabelText('Social Security annual benefit')).toHaveValue('80000');
    expect(screen.getByLabelText('Social Security claim age')).toHaveValue('70');
    expect(screen.getByLabelText('Healthcare phase')).toHaveValue('none');

    const totalPortfolio = screen.getByLabelText('Total portfolio');
    expect(totalPortfolio).toHaveAttribute('readonly');
    expect(totalPortfolio).toHaveValue('$4,100,000');
    expect(screen.getByText(/Open Portfolio mix to edit balances/i)).toBeInTheDocument();

    expect(screen.queryByLabelText('Traditional balance')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Net consulting income')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Plan-end age')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Current year')).not.toBeInTheDocument();

    for (const name of ['Portfolio mix', 'Other income', 'Withdrawal settings']) {
      const button = screen.getByRole('button', { name });

      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-controls');
      expect(button).toHaveClass('focus-visible:outline');
    }
    expect(screen.queryByRole('region', { name: /portfolio mix/i })).not.toBeInTheDocument();
  });

  it('reveals grouped controls with labelled regions and expanded toggle state', () => {
    renderVerdictForm();

    const portfolioButton = screen.getByRole('button', { name: 'Portfolio mix' });
    fireEvent.click(portfolioButton);
    const portfolioRegion = screen.getByRole('region', { name: 'Portfolio mix' });

    expect(portfolioButton).toHaveAttribute('aria-expanded', 'true');
    expect(portfolioRegion).toHaveAttribute('aria-labelledby', portfolioButton.id);
    expect(within(portfolioRegion).getByLabelText('Traditional balance')).toBeInTheDocument();
    expect(within(portfolioRegion).getByLabelText('Roth balance')).toBeInTheDocument();
    expect(within(portfolioRegion).getByLabelText('Brokerage plus cash balance')).toBeInTheDocument();
    expect(within(portfolioRegion).getByLabelText('Weighted-average taxable basis')).toBeInTheDocument();
    expect(within(portfolioRegion).getByLabelText('HSA balance')).toBeInTheDocument();
    expect(within(portfolioRegion).getByLabelText('Traditional expected return')).toBeInTheDocument();
    expect(within(portfolioRegion).getByLabelText('Roth expected return')).toBeInTheDocument();
    expect(within(portfolioRegion).getByLabelText('Brokerage expected return')).toBeInTheDocument();
    expect(within(portfolioRegion).getByLabelText('HSA expected return')).toBeInTheDocument();
    expect(within(portfolioRegion).getByLabelText('Brokerage dividend yield')).toBeInTheDocument();
    expect(within(portfolioRegion).getByLabelText('Qualified dividend percentage')).toBeInTheDocument();

    const otherIncomeButton = screen.getByRole('button', { name: 'Other income' });
    fireEvent.click(otherIncomeButton);
    const otherIncomeRegion = screen.getByRole('region', { name: 'Other income' });

    expect(otherIncomeButton).toHaveAttribute('aria-expanded', 'true');
    expect(within(otherIncomeRegion).getByLabelText('Net consulting income')).toBeInTheDocument();
    expect(within(otherIncomeRegion).getByLabelText('Net rental income')).toBeInTheDocument();
    expect(within(otherIncomeRegion).getByLabelText('Pension/annuity annual amount')).toBeInTheDocument();
    expect(within(otherIncomeRegion).getByLabelText('Annual mortgage P&I')).toBeInTheDocument();
    expect(within(otherIncomeRegion).getByLabelText('Mortgage payoff year')).toBeInTheDocument();

    const withdrawalButton = screen.getByRole('button', { name: 'Withdrawal settings' });
    fireEvent.click(withdrawalButton);
    const withdrawalRegion = screen.getByRole('region', { name: 'Withdrawal settings' });

    expect(withdrawalButton).toHaveAttribute('aria-expanded', 'true');
    expect(within(withdrawalRegion).getByLabelText('Current year')).toBeInTheDocument();
    expect(within(withdrawalRegion).getByLabelText('Plan-end age')).toBeInTheDocument();
    expect(within(withdrawalRegion).getByLabelText('Auto-deplete brokerage')).toBeInTheDocument();
    expect(within(withdrawalRegion).getByLabelText('Brokerage depletion years')).toBeInTheDocument();
    expect(within(withdrawalRegion).getByLabelText('Brokerage annual scale-up factor')).toBeInTheDocument();
  });

  it('updates the read-only total portfolio from existing bucket balances without changing debounce behavior', () => {
    renderVerdictForm();

    fireEvent.click(screen.getByRole('button', { name: 'Portfolio mix' }));
    fireEvent.change(screen.getByLabelText('Traditional balance'), { target: { value: '2100000' } });

    expect(screen.getByLabelText('Total portfolio')).toHaveValue('$4,200,000');
    expect(useScenarioStore.getState().formValues.traditionalBalance).toBe(2_000_000);

    advanceLiveDebounce();

    expect(useScenarioStore.getState().formValues.traditionalBalance).toBe(2_100_000);
  });

  it('keeps partner age conditional in the verdict first-class controls', () => {
    renderVerdictForm();

    expect(screen.getByLabelText('Partner age')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filing status'), { target: { value: 'single' } });

    expect(screen.queryByLabelText('Partner age')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filing status'), { target: { value: 'mfj' } });

    expect(screen.getByLabelText('Partner age')).toBeInTheDocument();
  });
});
