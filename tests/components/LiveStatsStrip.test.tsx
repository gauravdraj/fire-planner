import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LiveStatsStrip } from '@/components/LiveStatsStrip';
import { toReal } from '@/lib/realDollars';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

function statCells(): HTMLElement[] {
  return within(screen.getByLabelText('Live projection stats')).getAllByRole('listitem');
}

function statCell(id: string): HTMLElement {
  return screen.getByTestId(`live-stat-${id}`);
}

function cellAt(cells: readonly HTMLElement[], index: number): HTMLElement {
  const cell = cells[index];

  if (cell === undefined) {
    throw new Error(`Missing live stat cell ${index}`);
  }

  return cell;
}

describe('LiveStatsStrip', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the default scenario metrics in the required order', () => {
    render(<LiveStatsStrip />);

    const strip = screen.getByLabelText('Live projection stats');
    const cells = statCells();

    expect(strip).toHaveClass('sticky', 'top-0', 'z-10', 'bg-white/90', 'backdrop-blur');
    expect(cells).toHaveLength(6);
    expect(cellAt(cells, 0)).toHaveTextContent('Net worth at retirement');
    expect(cellAt(cells, 1)).toHaveTextContent('Plan-end balance');
    expect(cellAt(cells, 2)).toHaveTextContent('Years funded');
    expect(cellAt(cells, 3)).toHaveTextContent('Average MAGI');
    expect(cellAt(cells, 4)).toHaveTextContent('Max gross bucket draw');
    expect(cellAt(cells, 5)).toHaveTextContent('Total bridge tax');
    expect(within(cellAt(cells, 0)).getByText('$0')).toHaveClass('tabular-nums');
    expect(within(cellAt(cells, 1)).getByText('$0')).toHaveClass('tabular-nums');
    expect(within(cellAt(cells, 2)).getByText('1 year')).toHaveClass('tabular-nums');
    expect(within(cellAt(cells, 3)).getByText('$0')).toHaveClass('tabular-nums');
    expect(within(cellAt(cells, 4)).getByText('0%')).toHaveClass('tabular-nums');
    expect(within(cellAt(cells, 5)).getByText('$0')).toHaveClass('tabular-nums');
  });

  it('updates values after setFormValues and marks recently changed stats without deltas', async () => {
    useUiStore.getState().setDisplayUnit('nominal');
    render(<LiveStatsStrip />);

    act(() => {
      useScenarioStore.getState().setFormValues({
        annualSpendingToday: 0,
        brokerageAndCashBalance: 100_000,
        currentYear: 2026,
        planEndAge: 63,
        primaryAge: 60,
        retirementYear: 2028,
        rothBalance: 30_000,
        taxableBrokerageBasis: 100_000,
        traditionalBalance: 20_000,
      });
    });

    await waitFor(() => {
      expect(within(statCell('net-worth-at-retirement')).getByText('$150,000')).toBeInTheDocument();
    });

    expect(within(statCell('plan-end-balance')).getByText('$150,000')).toBeInTheDocument();
    expect(within(statCell('years-funded')).getByText('2 years')).toBeInTheDocument();
    expect(statCell('net-worth-at-retirement')).toHaveAttribute('data-recent-update', 'true');
    expect(screen.getByTestId('live-stat-pulse-net-worth-at-retirement')).toHaveClass('opacity-100', 'animate-pulse');
    expect(screen.queryByText(/\+|\u2212|delta/i)).not.toBeInTheDocument();

    act(() => {
      useUiStore.getState().setDisplayUnit('real');
    });

    const expectedRealRetirementBalance = DOLLAR_FORMATTER.format(toReal(150_000, 2028, 2026, 0.03));

    await waitFor(() => {
      expect(within(statCell('net-worth-at-retirement')).getByText(expectedRealRetirementBalance)).toBeInTheDocument();
    });
  });
});
