import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WhyChangedCallout } from '@/components/WhyChangedCallout';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

describe('WhyChangedCallout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders nothing on the initial projection', () => {
    seedBaselineProjection();

    render(<WhyChangedCallout />);

    expect(screen.queryByText('Why this changed')).not.toBeInTheDocument();
    expect(screen.queryByText(/large balance drop/i)).not.toBeInTheDocument();
  });

  it('shows a meaningful tracked projection change after the first render', () => {
    seedBaselineProjection();
    render(<WhyChangedCallout />);

    makeLargeBalanceDrop();

    expect(screen.getByText('Why this changed')).toBeInTheDocument();
    expect(screen.getByText(/compared with the previous projection for 2027/i)).toBeInTheDocument();
    expect(screen.getByText(/large balance drop/i)).toBeInTheDocument();
  });

  it('auto-dismisses after six seconds', () => {
    seedBaselineProjection();
    render(<WhyChangedCallout />);
    makeLargeBalanceDrop();

    expect(screen.getByText('Why this changed')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(screen.queryByText('Why this changed')).not.toBeInTheDocument();
  });

  it('can be dismissed manually', () => {
    seedBaselineProjection();
    render(<WhyChangedCallout />);
    makeLargeBalanceDrop();

    expect(screen.getByText('Why this changed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByText('Why this changed')).not.toBeInTheDocument();
  });
});

function seedBaselineProjection() {
  act(() => {
    useScenarioStore.getState().setFormValues({
      annualSpendingToday: 0,
      brokerageAndCashBalance: 1_000_000,
      currentYear: 2026,
      planEndAge: 70,
      primaryAge: 60,
      retirementYear: 2027,
      taxableBrokerageBasis: 1_000_000,
      traditionalBalance: 0,
      rothBalance: 0,
    });
  });
}

function makeLargeBalanceDrop() {
  act(() => {
    useScenarioStore.getState().setFormValues({
      brokerageAndCashBalance: 400_000,
      taxableBrokerageBasis: 400_000,
    });
  });
}
