import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AdvancedView } from '@/components/advanced/AdvancedView';
import { CONSTANTS_2026 } from '@/core/constants/2026';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

describe('AdvancedView', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing outside advanced mode', () => {
    render(<AdvancedView />);

    expect(screen.queryByRole('heading', { name: 'Advanced planner' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Custom law' })).not.toBeInTheDocument();
  });

  it('renders the required advanced tabs in advanced mode', () => {
    useUiStore.getState().setMode('advanced');

    render(<AdvancedView />);

    const advancedHeading = screen.getByRole('heading', { name: 'Advanced planner' });
    expect(advancedHeading).toBeInTheDocument();
    expect(advancedHeading.closest('section')).toHaveClass('min-w-0');
    expect(screen.getByRole('tab', { name: 'Custom law' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Manual plan' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Planner controls' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Planning charts' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Scenarios' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Manual plan' }));
    expect(screen.getByRole('heading', { name: 'Manual withdrawal planning' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Planner controls' }));
    expect(screen.getByRole('heading', { name: 'Generate Roth conversions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Generate brokerage harvests' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Planning charts' }));
    expect(screen.queryByRole('heading', { name: 'Projection summary' })).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: 'Planning charts' })).toHaveClass('min-w-0');
    expect(screen.getByRole('heading', { name: 'Year-by-year projection' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Account balances' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'MAGI thresholds' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tax breakdown' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Scenarios' }));
    expect(screen.getByRole('heading', { name: 'Scenario manager' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Compare two scenarios' })).not.toBeInTheDocument();
  });

  it('supports keyboard navigation across advanced tabs', () => {
    useUiStore.getState().setMode('advanced');

    render(<AdvancedView />);

    const customLawTab = screen.getByRole('tab', { name: 'Custom law' });
    const manualPlanTab = screen.getByRole('tab', { name: 'Manual plan' });
    const scenariosTab = screen.getByRole('tab', { name: 'Scenarios' });

    customLawTab.focus();
    fireEvent.keyDown(customLawTab, { key: 'ArrowRight' });

    expect(manualPlanTab).toHaveFocus();
    expect(manualPlanTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Manual withdrawal planning' })).toBeInTheDocument();

    fireEvent.keyDown(manualPlanTab, { key: 'End' });

    expect(scenariosTab).toHaveFocus();
    expect(scenariosTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Scenario manager' })).toBeInTheDocument();
  });

  it('saves sparse standard deduction overrides while showing defaults as placeholders', () => {
    useUiStore.getState().setMode('advanced');

    render(<AdvancedView />);

    const mfjDeductionInput = screen.getByLabelText('Married filing jointly');
    expect(mfjDeductionInput).toHaveAttribute('placeholder', String(CONSTANTS_2026.federal.standardDeduction.mfj));
    expect(mfjDeductionInput).toHaveValue(null);

    fireEvent.change(mfjDeductionInput, { target: { value: '35000' } });
    expect(useScenarioStore.getState().customLaw).toBeUndefined();
    expect(useScenarioStore.getState().customLawActive).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Save custom law edits' }));

    expect(useScenarioStore.getState().customLaw).toEqual({
      federal: {
        standardDeduction: {
          mfj: 35_000,
        },
      },
    });
    expect(useScenarioStore.getState().customLawActive).toBe(true);
    expect(screen.getByText('Custom-law edits saved.')).toBeInTheDocument();
  });

  it('saves federal ordinary and LTCG bracket overrides as sparse status-level arrays', () => {
    useUiStore.getState().setMode('advanced');

    render(<AdvancedView />);

    fireEvent.change(screen.getByLabelText('Federal ordinary brackets Single bracket 2 floor'), {
      target: { value: '13000' },
    });
    fireEvent.change(screen.getByLabelText('Long-term capital gains brackets Single bracket 2 rate'), {
      target: { value: '0.18' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save custom law edits' }));

    const expectedOrdinarySingle = CONSTANTS_2026.federal.ordinaryBrackets.single.map((bracket, index) =>
      index === 1 ? { ...bracket, from: 13_000 } : bracket,
    );
    const expectedLtcgSingle = CONSTANTS_2026.ltcg.brackets.single.map((bracket, index) =>
      index === 1 ? { ...bracket, rate: 0.18 } : bracket,
    );
    const customLaw = useScenarioStore.getState().customLaw;

    expect(customLaw?.federal?.ordinaryBrackets).toEqual({ single: expectedOrdinarySingle });
    expect(customLaw?.ltcg?.brackets).toEqual({ single: expectedLtcgSingle });
    expect(customLaw?.federal?.standardDeduction).toBeUndefined();
    expect(customLaw?.niit).toBeUndefined();
  });

  it('resets one override without clearing the rest', () => {
    useUiStore.getState().setMode('advanced');
    useScenarioStore.getState().setCustomLaw({
      federal: {
        standardDeduction: {
          mfj: 35_000,
        },
      },
      niit: {
        rate: 0.04,
      },
    });

    render(<AdvancedView />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset standard deduction Married filing jointly' }));

    expect(useScenarioStore.getState().customLaw).toEqual({
      niit: {
        rate: 0.04,
      },
    });
    expect(useScenarioStore.getState().customLawActive).toBe(true);
  });
});
