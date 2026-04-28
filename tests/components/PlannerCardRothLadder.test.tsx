import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlannerCardRothLadder } from '@/components/PlannerCardRothLadder';
import {
  buildDefaultRothLadderConstraint,
  defaultRothLadderPlannerRange,
  ROTH_LADDER_TARGET_ID,
} from '@/components/planners/RothLadderUI';
import { generateRothLadderPlan } from '@/core/planners/rothLadderTargeter';
import { toReal } from '@/lib/realDollars';
import { DEFAULT_BASIC_FORM_VALUES, useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

describe('PlannerCardRothLadder', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the default Roth targeter headline for a solvent plan and opens the targeter', async () => {
    useScenarioStore.getState().replaceFormValues({
      ...DEFAULT_BASIC_FORM_VALUES,
      annualSpendingToday: 0,
      annualSocialSecurityBenefit: 30_000,
      annualW2Income: 0,
      brokerageAndCashBalance: 0,
      brokerageDividendYield: 0,
      hsaBalance: 0,
      rothBalance: 0,
      socialSecurityClaimAge: 67,
      traditionalBalance: 250_000,
    });
    const expected = expectedFirstActionableConversion('real');
    const activateTarget = vi.fn();
    const scrollIntoView = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    render(
      <>
        <PlannerCardRothLadder onActivateTarget={activateTarget} />
        <div id={ROTH_LADDER_TARGET_ID} />
      </>,
    );

    expect(expected).not.toBeNull();
    expect(screen.getByRole('heading', { name: /could a roth ladder reduce future ira taxes/i })).toBeInTheDocument();
    expect(screen.getByText(expected as string)).toBeInTheDocument();
    expect(screen.getByText(/Limit: stay within the 12% federal bracket\./)).toBeInTheDocument();
    expect(screen.getByText(/Plan is funded through/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Roth ladder' }));

    expect(useUiStore.getState().advancedDisclosed).toBe(true);
    expect(activateTarget).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }));
  });

  it('still surfaces an actionable conversion when the current plan is insolvent', () => {
    useScenarioStore.getState().replaceFormValues({
      ...DEFAULT_BASIC_FORM_VALUES,
      annualSocialSecurityBenefit: 0,
      annualSpendingToday: 50_000,
      annualW2Income: 0,
      brokerageAndCashBalance: 0,
      brokerageDividendYield: 0,
      hsaBalance: 0,
      planEndAge: 95,
      rothBalance: 0,
      traditionalBalance: 100_000,
    });
    const expected = expectedFirstActionableConversion('real');

    render(<PlannerCardRothLadder />);

    expect(expected).not.toBeNull();
    expect(screen.getByText(expected as string)).toBeInTheDocument();
    expect(screen.getByText(/Plan depletes in \d{4}; review spending runway before applying conversions\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Roth ladder' })).toBeInTheDocument();
  });

  it('hides the CTA when the targeter finds no actionable Roth conversion', () => {
    useScenarioStore.getState().replaceFormValues({
      ...DEFAULT_BASIC_FORM_VALUES,
      brokerageDividendYield: 0,
      traditionalBalance: 0,
    });

    render(<PlannerCardRothLadder />);

    expect(screen.getByText('No conversion suggested')).toBeInTheDocument();
    expect(screen.getByText('No Roth conversion headroom found under the default limit.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Roth ladder' })).not.toBeInTheDocument();
  });
});

function expectedFirstActionableConversion(displayUnit: 'real' | 'nominal'): string | null {
  const { plan, scenario } = useScenarioStore.getState();
  const range = defaultRothLadderPlannerRange(scenario, plan);
  const result = generateRothLadderPlan({
    basePlan: plan,
    constraint: buildDefaultRothLadderConstraint(scenario),
    endYear: range.endYear,
    scenario,
    startYear: range.startYear,
  });
  const actionableYear = result.years.find((year) => year.conversionAmount > 0) ?? null;

  if (actionableYear === null) {
    return null;
  }

  const amount =
    displayUnit === 'real'
      ? toReal(actionableYear.conversionAmount, actionableYear.year, scenario.startYear, scenario.inflationRate)
      : actionableYear.conversionAmount;

  return DOLLAR_FORMATTER.format(amount);
}
