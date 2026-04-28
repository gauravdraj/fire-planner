import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import type { YearBreakdown } from '@/core/projection';
import { STARTER_TEMPLATES } from '@/lib/starterTemplates';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

function clickTemplate(label: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: label }));
}

function advanceBalanceHintDebounce() {
  act(() => {
    vi.advanceTimersByTime(151);
  });
}

function cellFor(year: number, columnId: string): HTMLElement {
  return screen.getByTestId(`year-table-cell-${year}-${columnId}`);
}

function formatMoney(amount: number): string {
  return MONEY_FORMATTER.format(amount);
}

function liveStatValue(id: string): string {
  return screen.getByTestId(`live-stat-${id}`).querySelector('.tabular-nums')?.textContent ?? '';
}

function numericMoney(value: string): number {
  return Number(value.replace(/[^-\d]/g, ''));
}

function totalClosingBalance(row: YearBreakdown): number {
  return (
    row.closingBalances.cash +
    row.closingBalances.hsa +
    row.closingBalances.roth +
    row.closingBalances.taxableBrokerage +
    row.closingBalances.traditional
  );
}

function yearOrThrow(rows: readonly YearBreakdown[], year: number): YearBreakdown {
  const row = rows.find((breakdown) => breakdown.year === year);

  if (row === undefined) {
    throw new Error(`Expected projection row for ${year}.`);
  }

  return row;
}

describe('Phase 1B starter-template integration smoke', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useUiStore.getState().setDisplayUnit('nominal');
    useScenarioStore.getState().resetScenario();
    window.history.replaceState(null, '', '/planner?case=phase1b');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('loads both Phase 1B templates through the app and updates form, table, auto-deplete, and balance hints', () => {
    const brokerageBridgeTemplate = STARTER_TEMPLATES[0];
    const rothLadderTemplate = STARTER_TEMPLATES[1];

    render(<App />);
    vi.useFakeTimers();

    clickTemplate(/brokerage bridge with 72\(t\) context/i);
    advanceBalanceHintDebounce();

    expect(screen.getByLabelText('State')).toHaveValue(brokerageBridgeTemplate.formValues.stateCode);
    expect(screen.getByLabelText('Annual spending')).toHaveValue(
      String(brokerageBridgeTemplate.formValues.annualSpendingToday),
    );
    expect(screen.getByLabelText('Brokerage depletion years')).toHaveValue(
      String(brokerageBridgeTemplate.formValues.autoDepleteBrokerageYears),
    );
    expect(screen.getByLabelText('Auto-deplete brokerage')).toBeChecked();

    const brokerageState = useScenarioStore.getState();
    const brokerageRows = brokerageState.projectionResults;
    const brokerage2026 = yearOrThrow(brokerageRows, 2026);
    const brokerage2027 = yearOrThrow(brokerageRows, 2027);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^year-table-row-/)).toHaveLength(brokerageRows.length);
    expect(brokerageRows.length).toBeGreaterThan(0);
    expect(numericMoney(cellFor(2026, 'endingBalance').textContent ?? '')).toBeGreaterThan(0);

    expect(brokerage2026.withdrawals.taxableBrokerage).toBeGreaterThan(0);
    expect(brokerage2027.withdrawals.taxableBrokerage).toBeGreaterThan(brokerage2026.withdrawals.taxableBrokerage);
    expect(cellFor(2026, 'brokerageWithdrawals')).toHaveTextContent(
      formatMoney(brokerage2026.withdrawals.taxableBrokerage),
    );
    expect(cellFor(2027, 'brokerageWithdrawals')).toHaveTextContent(
      formatMoney(brokerage2027.withdrawals.taxableBrokerage),
    );

    const knownHintYear = yearOrThrow(brokerageRows, 2034);
    expect(Math.abs(knownHintYear.afterTaxCashFlow)).toBeGreaterThan(0);
    expect(cellFor(knownHintYear.year, 'afterTaxCashFlow')).toHaveTextContent(/\u2192 balanced/);

    const brokeragePlanEndBalance = numericMoney(liveStatValue('plan-end-balance'));
    const brokerage2026Spending = brokerage2026.spending;

    expect(brokeragePlanEndBalance).toBeGreaterThan(0);

    clickTemplate(/roth ladder bridge/i);
    advanceBalanceHintDebounce();

    expect(screen.getByLabelText('State')).toHaveValue(rothLadderTemplate.formValues.stateCode);
    expect(screen.getByLabelText('Annual spending')).toHaveValue(String(rothLadderTemplate.formValues.annualSpendingToday));
    expect(screen.getByLabelText('Annual mortgage P&I')).toHaveValue(
      String(rothLadderTemplate.formValues.annualMortgagePAndI),
    );
    expect(screen.getByLabelText('Brokerage depletion years')).toHaveValue(
      String(rothLadderTemplate.formValues.autoDepleteBrokerageYears),
    );
    expect(screen.getByLabelText('Auto-deplete brokerage')).toBeChecked();

    const rothState = useScenarioStore.getState();
    const roth2026 = yearOrThrow(rothState.projectionResults, 2026);
    const rothPlanEndBalance = numericMoney(liveStatValue('plan-end-balance'));

    expect(rothState.projectionResults.length).toBeGreaterThan(0);
    expect(rothPlanEndBalance).toBeGreaterThan(0);
    expect(rothPlanEndBalance).not.toBe(brokeragePlanEndBalance);
    expect(roth2026.spending).not.toBe(brokerage2026Spending);
    expect(cellFor(2026, 'spending')).toHaveTextContent(formatMoney(roth2026.spending));
    expect(cellFor(2026, 'endingBalance')).toHaveTextContent(formatMoney(totalClosingBalance(roth2026)));
  }, 10_000);
});
