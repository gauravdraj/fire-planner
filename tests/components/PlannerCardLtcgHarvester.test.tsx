import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlannerCardLtcgHarvester } from '@/components/PlannerCardLtcgHarvester';
import {
  defaultLtcgHarvesterPlannerRange,
  LTCG_HARVESTER_TARGET_ID,
} from '@/components/planners/LtcgHarvesterUI';
import { generateLtcgHarvestPlan } from '@/core/planners/ltcgHarvester';
import { toReal } from '@/lib/realDollars';
import { DEFAULT_BASIC_FORM_VALUES, useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

describe('PlannerCardLtcgHarvester', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the default LTCG harvest headline for a solvent plan and opens the harvester', async () => {
    useScenarioStore.getState().replaceFormValues({
      ...DEFAULT_BASIC_FORM_VALUES,
      annualSocialSecurityBenefit: 0,
      annualSpendingToday: 0,
      annualW2Income: 0,
      brokerageAndCashBalance: 200_000,
      brokerageDividendYield: 0,
      hsaBalance: 0,
      planEndAge: 60,
      retirementYear: 2026,
      rothBalance: 0,
      taxableBrokerageBasis: 100_000,
      traditionalBalance: 0,
    });
    const expected = expectedFirstActionableHarvest('real');
    const activateTarget = vi.fn();
    const scrollIntoView = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    render(
      <>
        <PlannerCardLtcgHarvester onActivateTarget={activateTarget} />
        <div id={LTCG_HARVESTER_TARGET_ID} />
      </>,
    );

    expect(expected).not.toBeNull();
    expect(screen.getByRole('heading', { name: /can you harvest taxable gains at 0%/i })).toBeInTheDocument();
    expect(screen.getByText(expected as string)).toBeInTheDocument();
    expect(screen.getByText(/Default: fill the 0% LTCG bracket; ACA and IRMAA guards are off\./)).toBeInTheDocument();
    expect(screen.getByText(/Plan is funded through/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open gain harvester' }));

    expect(useUiStore.getState().advancedDisclosed).toBe(true);
    expect(activateTarget).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }));
  });

  it('still surfaces an actionable harvest when the current plan is insolvent', () => {
    useScenarioStore.getState().replaceFormValues({
      ...DEFAULT_BASIC_FORM_VALUES,
      annualSocialSecurityBenefit: 0,
      annualSpendingToday: 70_000,
      annualW2Income: 0,
      brokerageAndCashBalance: 200_000,
      brokerageDividendYield: 0,
      hsaBalance: 0,
      planEndAge: 95,
      retirementYear: 2026,
      rothBalance: 0,
      taxableBrokerageBasis: 100_000,
      traditionalBalance: 0,
    });
    const expected = expectedFirstActionableHarvest('real');

    render(<PlannerCardLtcgHarvester />);

    expect(expected).not.toBeNull();
    expect(screen.getByText(expected as string)).toBeInTheDocument();
    expect(screen.getByText(/Plan depletes in \d{4}; review spending runway before harvesting gains\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open gain harvester' })).toBeInTheDocument();
  });

  it('recognizes when the default harvest plan is already applied', () => {
    useScenarioStore.getState().replaceFormValues({
      ...DEFAULT_BASIC_FORM_VALUES,
      annualSocialSecurityBenefit: 0,
      annualSpendingToday: 0,
      annualW2Income: 0,
      brokerageAndCashBalance: 200_000,
      brokerageDividendYield: 0,
      hsaBalance: 0,
      planEndAge: 60,
      retirementYear: 2026,
      rothBalance: 0,
      taxableBrokerageBasis: 100_000,
      traditionalBalance: 0,
    });
    const expected = expectedFirstActionableHarvest('real');
    applyDefaultLtcgHarvestPlan();

    render(<PlannerCardLtcgHarvester />);

    expect(expected).not.toBeNull();
    expect(screen.getByText(expected as string)).toBeInTheDocument();
    expect(screen.getByText('Default 0% LTCG harvests already match this plan.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open gain harvester' })).not.toBeInTheDocument();
  });

  it('hides the CTA when the harvester finds no actionable brokerage gain', () => {
    useScenarioStore.getState().replaceFormValues({
      ...DEFAULT_BASIC_FORM_VALUES,
      annualSocialSecurityBenefit: 0,
      annualSpendingToday: 0,
      annualW2Income: 0,
      brokerageAndCashBalance: 200_000,
      brokerageDividendYield: 0,
      expectedReturnBrokerage: 0,
      hsaBalance: 0,
      planEndAge: 60,
      retirementYear: 2026,
      rothBalance: 0,
      taxableBrokerageBasis: 200_000,
      traditionalBalance: 0,
    });

    render(<PlannerCardLtcgHarvester />);

    expect(screen.getByText('No harvest suggested')).toBeInTheDocument();
    expect(
      screen.getByText('No 0% LTCG headroom found with embedded brokerage gains.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open gain harvester' })).not.toBeInTheDocument();
  });
});

function expectedFirstActionableHarvest(displayUnit: 'real' | 'nominal'): string | null {
  const { plan, scenario } = useScenarioStore.getState();
  const range = defaultLtcgHarvesterPlannerRange(scenario, plan);
  const result = generateLtcgHarvestPlan({
    basePlan: plan,
    endYear: range.endYear,
    scenario,
    startYear: range.startYear,
  });
  const actionableYear = result.years.find((year) => year.harvestAmount > 0) ?? null;

  if (actionableYear === null) {
    return null;
  }

  const amount =
    displayUnit === 'real'
      ? toReal(actionableYear.harvestAmount, actionableYear.year, scenario.startYear, scenario.inflationRate)
      : actionableYear.harvestAmount;

  return DOLLAR_FORMATTER.format(amount);
}

function applyDefaultLtcgHarvestPlan(): void {
  const { plan, scenario } = useScenarioStore.getState();
  const range = defaultLtcgHarvesterPlannerRange(scenario, plan);
  const result = generateLtcgHarvestPlan({
    basePlan: plan,
    endYear: range.endYear,
    scenario,
    startYear: range.startYear,
  });

  useScenarioStore.getState().setPlan(result.plan);
}
