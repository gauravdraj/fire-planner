import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SummaryCards } from '@/components/SummaryCards';
import { CONSTANTS_2026 } from '@/core/constants/2026';
import { DEFAULT_BASIC_FORM_VALUES, useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

function dateAtTaxDataAge(ageDays: number): string {
  const date = new Date(`${CONSTANTS_2026.retrievedAt}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + ageDays);

  return date.toISOString().slice(0, 10);
}

function setFundedScenario() {
  useScenarioStore.getState().replaceFormValues({
    ...DEFAULT_BASIC_FORM_VALUES,
    annualSpendingToday: 0,
    brokerageAndCashBalance: 1_000,
    currentYear: 2026,
    planEndAge: 63,
    primaryAge: 60,
    retirementYear: 2028,
    rothBalance: 3_000,
    taxableBrokerageBasis: 1_000,
    traditionalBalance: 2_000,
  });
}

function setDepletedScenario() {
  useScenarioStore.getState().replaceFormValues({
    ...DEFAULT_BASIC_FORM_VALUES,
    annualSpendingToday: 1_000,
    brokerageAndCashBalance: 500,
    currentYear: 2026,
    planEndAge: 63,
    primaryAge: 60,
    retirementYear: 2026,
    rothBalance: 0,
    taxableBrokerageBasis: 500,
    traditionalBalance: 0,
  });
}

function getCard(name: RegExp) {
  return screen.getByRole('article', { name });
}

describe('SummaryCards', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders exactly the three Gate 3 summary cards with nominal metrics', () => {
    setFundedScenario();
    useUiStore.getState().setDisplayUnit('nominal');

    render(<SummaryCards now={dateAtTaxDataAge(0)} />);

    expect(screen.getAllByRole('article')).toHaveLength(3);

    const retirementCard = getCard(/net worth at retirement/i);
    const planEndCard = getCard(/plan-end balance/i);
    const yearsFundedCard = getCard(/years funded/i);

    expect(within(retirementCard).getByText('$6,000')).toHaveClass('tabular-nums');
    expect(retirementCard).toHaveTextContent('Opening supported balances in 2028.');
    expect(retirementCard).toHaveTextContent('nominal dollars');
    expect(within(planEndCard).getByText('$6,000')).toBeInTheDocument();
    expect(planEndCard).toHaveTextContent('Closing balance in 2029.');
    expect(within(yearsFundedCard).getByText('4 years')).toBeInTheDocument();
    expect(yearsFundedCard).toHaveTextContent('Fully funded through plan-end age 63.');
  });

  it('converts balance cards between real and nominal display units', () => {
    setFundedScenario();

    render(<SummaryCards now={dateAtTaxDataAge(0)} />);

    const realRetirementCard = getCard(/net worth at retirement/i);
    expect(within(realRetirementCard).getByText('$5,656')).toBeInTheDocument();
    expect(realRetirementCard).toHaveTextContent("today's dollars");

    cleanup();
    useUiStore.getState().setDisplayUnit('nominal');

    render(<SummaryCards now={dateAtTaxDataAge(0)} />);

    const nominalRetirementCard = getCard(/net worth at retirement/i);
    expect(within(nominalRetirementCard).getByText('$6,000')).toBeInTheDocument();
    expect(nominalRetirementCard).toHaveTextContent('nominal dollars');
  });

  it('counts years funded until supported balances hit zero', () => {
    setDepletedScenario();
    useUiStore.getState().setDisplayUnit('nominal');

    render(<SummaryCards now={dateAtTaxDataAge(0)} />);

    const yearsFundedCard = getCard(/years funded/i);

    expect(within(yearsFundedCard).getByText('1 year')).toBeInTheDocument();
    expect(yearsFundedCard).toHaveTextContent('Supported balances hit zero in 2026.');
  });

  it('marks output values as stale for soft and hard tax-data staleness', () => {
    setFundedScenario();
    useUiStore.getState().setDisplayUnit('nominal');

    const { rerender } = render(<SummaryCards now={dateAtTaxDataAge(540)} />);

    expect(within(getCard(/net worth at retirement/i)).getByText('$6,000')).toHaveAttribute('data-stale', 'true');
    expect(within(getCard(/plan-end balance/i)).getByText('$6,000')).toHaveAttribute('data-stale', 'true');
    expect(within(getCard(/years funded/i)).getByText('4 years')).toHaveAttribute('data-stale', 'true');

    rerender(<SummaryCards now={dateAtTaxDataAge(900)} />);

    expect(within(getCard(/net worth at retirement/i)).getByText('$6,000')).toHaveAttribute('data-stale', 'true');
  });
});
