import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SeventyTwoTCalc } from '@/components/SeventyTwoTCalc';
import { compute72tIraSize } from '@/core/seventyTwoT';

const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: 'currency',
});

function advanceCalculatorDebounce() {
  act(() => {
    vi.advanceTimersByTime(151);
  });
}

function changeField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function formatIraSize(ratePercent: number, lifeExpectancyYears: number, annualIncome: number): string {
  return MONEY_FORMATTER.format(compute72tIraSize(ratePercent / 100, lifeExpectancyYears, annualIncome));
}

describe('SeventyTwoTCalc', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the default required IRA size', () => {
    render(<SeventyTwoTCalc />);

    expect(screen.getByLabelText('Rate percent')).toHaveValue(5);
    expect(screen.getByLabelText('Life expectancy years')).toHaveValue(33.4);
    expect(screen.getByLabelText('Desired annual income')).toHaveValue(50000);
    expect(screen.getByText('Required IRA size')).toBeInTheDocument();
    expect(screen.getByText('$803,990.37')).toHaveClass('tabular-nums');
  });

  it('updates the output after the rate changes', () => {
    render(<SeventyTwoTCalc />);

    changeField('Rate percent', '4');

    expect(screen.getByText('$803,990.37')).toBeInTheDocument();

    advanceCalculatorDebounce();

    expect(screen.getByText(formatIraSize(4, 33.4, 50_000))).toBeInTheDocument();
  });

  it('updates the output after life expectancy changes', () => {
    render(<SeventyTwoTCalc />);

    changeField('Life expectancy years', '40');
    advanceCalculatorDebounce();

    expect(screen.getByText(formatIraSize(5, 40, 50_000))).toBeInTheDocument();
  });

  it('updates the output after desired annual income changes', () => {
    render(<SeventyTwoTCalc />);

    changeField('Desired annual income', '60000');
    advanceCalculatorDebounce();

    expect(screen.getByText(formatIraSize(5, 33.4, 60_000))).toBeInTheDocument();
  });

  it('renders zero values gracefully', () => {
    render(<SeventyTwoTCalc />);

    changeField('Rate percent', '0');
    changeField('Life expectancy years', '0');
    changeField('Desired annual income', '0');
    advanceCalculatorDebounce();

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });
});
