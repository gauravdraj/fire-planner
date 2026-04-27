import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { runProjection, type YearBreakdown } from '@/core/projection';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

function changeField(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function advanceLiveDebounce() {
  act(() => {
    vi.advanceTimersByTime(151);
  });
}

function liveStat(id: string): HTMLElement {
  return screen.getByTestId(`live-stat-${id}`);
}

function liveStatValue(id: string): string {
  return liveStat(id).querySelector('.tabular-nums')?.textContent ?? '';
}

function numericMoney(value: string): number {
  return Number(value.replace(/[^-\d]/g, ''));
}

function numericPercent(value: string): number {
  return Number(value.replace('%', '')) / 100;
}

function cellFor(year: number, columnId: string): HTMLElement {
  return screen.getByTestId(`year-table-cell-${year}-${columnId}`);
}

function yearOrThrow(rows: readonly YearBreakdown[], year: number): YearBreakdown {
  const row = rows.find((breakdown) => breakdown.year === year);

  if (row === undefined) {
    throw new Error(`Expected projection row for ${year}.`);
  }

  return row;
}

function valueAt(values: readonly number[], index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new Error(`Expected numeric value at index ${index}.`);
  }

  return value;
}

function fillPhase1AInputs() {
  changeField('Filing status', 'single');
  changeField('State', 'FL');
  changeField('Primary age', '60');
  changeField('Current year', '2026');
  changeField('Retirement target year', '2029');
  changeField('Plan-end age', '70');
  changeField('Social Security claim age', '67');
  changeField('Annual spending', '40000');
  changeField('Annual mortgage P&I', '12000');
  changeField('Mortgage payoff year', '2030');
  changeField('Traditional balance', '600000');
  changeField('Roth balance', '150000');
  changeField('Brokerage plus cash balance', '400000');
  changeField('Weighted-average taxable basis', '300000');
  changeField('HSA balance', '50000');
  changeField('Traditional expected return', '0.04');
  changeField('Roth expected return', '0.06');
  changeField('Brokerage expected return', '0.03');
  changeField('HSA expected return', '0.02');
  changeField('Brokerage dividend yield', '0.02');
  changeField('Qualified dividend percentage', '0.8');
  changeField('Brokerage depletion years', '5');
  changeField('Brokerage annual scale-up factor', '0.03');
  changeField('W-2 income', '90000');
  changeField('Net consulting income', '0');
  changeField('Net rental income', '0');
  changeField('Social Security annual benefit', '0');
  changeField('Pension/annuity annual amount', '60000');
  changeField('Healthcare phase', 'none');
}

function formatMoney(amount: number): string {
  return MONEY_FORMATTER.format(amount);
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

describe('Phase 1A basic-form integration smoke', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useUiStore.getState().setDisplayUnit('nominal');
    useScenarioStore.getState().resetScenario();
    window.history.replaceState(null, '', '/planner?case=phase1a');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('drives the Phase 1A inputs together through live stats and year-table output', () => {
    render(<App />);

    expect(screen.getByRole('form', { name: /basic scenario form/i })).toBeInTheDocument();

    vi.useFakeTimers();
    fillPhase1AInputs();
    advanceLiveDebounce();

    const planEndWithReturns = numericMoney(liveStatValue('plan-end-balance'));
    changeField('Traditional expected return', '0');
    advanceLiveDebounce();
    expect(numericMoney(liveStatValue('plan-end-balance'))).toBeLessThan(planEndWithReturns);

    changeField('Traditional expected return', '0.04');
    advanceLiveDebounce();
    const maxBridgeDrawBeforeAutoDeplete = numericPercent(liveStatValue('max-bridge-draw-percentage'));

    fireEvent.click(screen.getByLabelText('Auto-deplete brokerage'));
    advanceLiveDebounce();

    const maxBridgeDrawAfterAutoDeplete = numericPercent(liveStatValue('max-bridge-draw-percentage'));
    expect(maxBridgeDrawAfterAutoDeplete).toBeGreaterThan(maxBridgeDrawBeforeAutoDeplete);

    vi.useRealTimers();

    const { plan, projectionResults, scenario } = useScenarioStore.getState();
    const preRetirementYear = yearOrThrow(projectionResults, 2028);
    const retirementYear = yearOrThrow(projectionResults, 2029);
    const payoffYear = yearOrThrow(projectionResults, 2030);
    const postPayoffYear = yearOrThrow(projectionResults, 2031);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: 'Spending' })).toBeInTheDocument();

    expect(retirementYear.spending).toBeCloseTo(40_000 * 1.03 ** 3 + 12_000, 2);
    expect(payoffYear.spending).toBeCloseTo(40_000 * 1.03 ** 4 + 12_000, 2);
    expect(postPayoffYear.spending).toBeCloseTo(40_000 * 1.03 ** 5, 2);
    expect(cellFor(2029, 'spending')).toHaveTextContent(formatMoney(retirementYear.spending));
    expect(cellFor(2030, 'spending')).toHaveTextContent(formatMoney(payoffYear.spending));
    expect(cellFor(2031, 'spending')).toHaveTextContent(formatMoney(postPayoffYear.spending));

    expect(retirementYear.closingBalances.hsa).toBeGreaterThan(0);
    expect(cellFor(2029, 'hsaBalance')).toHaveTextContent(formatMoney(retirementYear.closingBalances.hsa));

    const { brokerageDividends: _omittedDividends, ...scenarioWithoutDividends } = scenario;
    const noDividendRetirementYear = yearOrThrow(runProjection(scenarioWithoutDividends, plan), 2029);
    expect(retirementYear.brokerageDividends?.total).toBeGreaterThan(0);
    expect(retirementYear.agi).toBeGreaterThan(noDividendRetirementYear.agi);
    expect(retirementYear.totalTax).toBeGreaterThan(noDividendRetirementYear.totalTax);
    expect(cellFor(2029, 'agi')).toHaveTextContent(formatMoney(retirementYear.agi));
    expect(cellFor(2029, 'totalTax')).toHaveTextContent(formatMoney(retirementYear.totalTax));

    const autoDepleteDraws = [2029, 2030, 2031, 2032, 2033].map(
      (year) => yearOrThrow(projectionResults, year).withdrawals.taxableBrokerage,
    );
    const firstAutoDepleteDraw = valueAt(autoDepleteDraws, 0);
    const secondAutoDepleteDraw = valueAt(autoDepleteDraws, 1);
    const thirdAutoDepleteDraw = valueAt(autoDepleteDraws, 2);

    expect(preRetirementYear.withdrawals.taxableBrokerage).toBe(0);
    expect(autoDepleteDraws.every((draw) => draw > 0)).toBe(true);
    expect(secondAutoDepleteDraw / firstAutoDepleteDraw).toBeCloseTo(1.03, 3);
    expect(thirdAutoDepleteDraw / secondAutoDepleteDraw).toBeCloseTo(1.03, 3);
    expect(yearOrThrow(projectionResults, 2033).closingBalances.taxableBrokerage).toBeLessThan(
      retirementYear.openingBalances.taxableBrokerage,
    );
    expect(cellFor(2029, 'brokerageWithdrawals')).toHaveTextContent(formatMoney(firstAutoDepleteDraw));

    const cumulativeBridgeTax = roundToCents(retirementYear.totalTax + payoffYear.totalTax);
    expect(cumulativeBridgeTax).toBe(17_171.59);
    expect(liveStatValue('total-bridge-tax')).toBe(formatMoney(cumulativeBridgeTax));
  }, 10_000);
});
