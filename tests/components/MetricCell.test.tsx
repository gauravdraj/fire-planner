import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MetricCell } from '@/components/MetricCell';

describe('MetricCell', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each([
    ['below Medicaid threshold', 1.2, 'bg-rose-100 text-rose-800'],
    ['lower ACA range', 1.5, 'bg-amber-50 text-amber-800'],
    ['ACA sweet spot', 2.5, 'bg-emerald-100 text-emerald-900'],
    ['near cliff range', 3.5, 'bg-amber-100 text-amber-900'],
    ['above cliff range', 4.1, 'bg-rose-200 text-rose-950 font-bold dark:bg-rose-900/70 dark:text-rose-100'],
  ])('applies FPL band classes for %s', (_label, rawNumeric, expectedClassName) => {
    render(<MetricCell bandType="fpl" displayText={`${rawNumeric}x FPL`} rawNumeric={rawNumeric} />);

    expect(screen.getByText(`${rawNumeric}x FPL`)).toHaveClass(...expectedClassName.split(' '));
  });

  it.each([
    ['safe', 0.039, 'bg-emerald-50 text-emerald-800'],
    ['caution', 0.04, 'bg-amber-100 text-amber-900'],
    ['danger', 0.05, 'bg-rose-100 text-rose-800 dark:bg-rose-950/55 dark:text-rose-200'],
    ['catastrophic', 0.101, 'bg-rose-200 text-rose-950 font-bold dark:bg-rose-900/70 dark:text-rose-100'],
  ])('applies withdrawal-rate classes for %s values', (_label, rawNumeric, expectedClassName) => {
    render(<MetricCell bandType="wdRate" displayText={`${rawNumeric * 100}%`} rawNumeric={rawNumeric} />);

    expect(screen.getByText(`${rawNumeric * 100}%`)).toHaveClass(...expectedClassName.split(' '));
  });

  it('uses neutral withdrawal-rate styling for plan-end depletion', () => {
    render(<MetricCell bandType="wdRate" displayText="24.4%" metricBand="plan-end" rawNumeric={0.244} />);

    const cell = screen.getByText('24.4%');

    expect(cell).toHaveClass('bg-slate-100', 'text-slate-700');
    expect(cell).not.toHaveClass('bg-rose-200', 'text-rose-950', 'font-bold');
  });

  it('emphasizes negative cashflow and leaves non-negative cashflow neutral', () => {
    render(
      <div>
        <MetricCell bandType="cashflow" displayText="-$500" rawNumeric={-500} />
        <MetricCell bandType="cashflow" displayText="$0" rawNumeric={0} />
        <MetricCell bandType="cashflow" displayText="$500" rawNumeric={500} />
      </div>,
    );

    expect(screen.getByText('-$500')).toHaveClass('text-rose-700', 'font-semibold');
    expect(screen.getByText('$0')).not.toHaveClass('text-rose-700', 'font-semibold');
    expect(screen.getByText('$500')).not.toHaveClass('text-rose-700', 'font-semibold');
  });

  it('renders null raw values without threshold banding', () => {
    render(<MetricCell bandType="fpl" className="text-right" displayText="-" label="FPL percentage" rawNumeric={null} />);

    const cell = screen.getByLabelText('FPL percentage: -');

    expect(cell).toHaveTextContent('-');
    expect(cell).toHaveClass('tabular-nums', 'transition-colors', 'duration-700', 'text-right');
    expect(cell.className).not.toMatch(/\bbg-(rose|amber|emerald)-/);
    expect(cell.className).not.toMatch(/\btext-(rose|amber|emerald)-/);
    expect(cell).not.toHaveClass('font-bold', 'font-semibold');
  });

  it('pulses when the pulse key changes and then restores metric band classes', () => {
    vi.useFakeTimers();
    const { rerender } = render(<MetricCell bandType="wdRate" displayText="4.0%" rawNumeric={0.04} pulseKey={0.04} />);

    expect(screen.getByText('4.0%')).toHaveClass('bg-amber-100', 'text-amber-900');
    expect(screen.getByText('4.0%')).not.toHaveClass('bg-yellow-100');

    act(() => {
      rerender(<MetricCell bandType="wdRate" displayText="5.0%" rawNumeric={0.05} pulseKey={0.05} />);
    });

    const pulsingCell = screen.getByText('5.0%');

    expect(pulsingCell).toHaveClass('bg-yellow-100', 'dark:bg-yellow-900/40', 'text-rose-800', 'transition-colors', 'duration-700');
    expect(pulsingCell).not.toHaveClass('bg-rose-100');

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByText('5.0%')).toHaveClass('bg-rose-100', 'text-rose-800');
    expect(screen.getByText('5.0%')).not.toHaveClass('bg-yellow-100');
  });
});
