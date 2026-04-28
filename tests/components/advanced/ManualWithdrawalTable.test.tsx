import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ManualWithdrawalTable } from '@/components/advanced/ManualWithdrawalTable';
import { balanceSweepContract } from '@/lib/exportContracts';
import { useScenarioStore } from '@/store/scenarioStore';

import { installMemoryLocalStorage } from '../../store/memoryStorage';

describe('ManualWithdrawalTable', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Balance all years as unavailable while the plan contract has no brokerage withdrawal override', () => {
    render(<ManualWithdrawalTable />);

    expect(balanceSweepContract.supported).toBe(false);
    expect(balanceSweepContract.inspectedFields).toEqual(['annualSpending', 'rothConversions', 'brokerageHarvests']);
    expect(screen.getByRole('button', { name: 'Balance all years' })).toBeDisabled();
    expect(screen.getByText(/Account-specific manual withdrawal overrides are deferred/i)).toBeInTheDocument();
    expect(screen.getByText(/require projection engine contract changes/i)).toBeInTheDocument();
  });

  it('keeps Balance all years disabled when no projection is available', () => {
    useScenarioStore.setState({ projectionResults: [] });

    render(<ManualWithdrawalTable />);

    expect(screen.getByRole('button', { name: 'Balance all years' })).toBeDisabled();
    expect(screen.getByText(/needs an active scenario and projection/i)).toBeInTheDocument();
  });

  it('does not mutate annual spending or treat spending as brokerage funding while deferred', () => {
    const priorPlan = useScenarioStore.getState().plan;

    render(<ManualWithdrawalTable />);
    fireEvent.click(screen.getByRole('button', { name: 'Balance all years' }));

    expect(useScenarioStore.getState().plan).toEqual(priorPlan);
    expect(useScenarioStore.getState().plan.annualSpending.every((entry) => entry.amount >= 0)).toBe(true);
  });
});
