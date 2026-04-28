import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BasicPlannerPage } from '@/components/BasicPlannerPage';
import { StarterTemplateChooser } from '@/components/StarterTemplateChooser';
import { STARTER_TEMPLATES } from '@/lib/starterTemplates';
import { DEFAULT_BASIC_FORM_VALUES, useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('StarterTemplateChooser', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installMemoryLocalStorage();
    window.history.replaceState(null, '', '/');
    useUiStore.getState().resetUiPreferences();
    useUiStore.getState().setLayout('classic');
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders all five starter template buttons and compact sample explanation', () => {
    render(<StarterTemplateChooser />);

    expect(screen.getByRole('heading', { name: /sample scenarios/i })).toBeInTheDocument();
    expect(STARTER_TEMPLATES).toHaveLength(5);
    expect(screen.getAllByRole('button')).toHaveLength(5);

    for (const template of STARTER_TEMPLATES) {
      const button = screen.getByRole('button', { name: new RegExp(escapeRegExp(template.label), 'i') });

      expect(within(button).getByText(template.label)).toBeInTheDocument();
      expect(within(button).getByText(template.shortDescription)).toBeInTheDocument();
    }

    const explanation = screen.getByText(/Samples update the projection instantly/i);
    expect(explanation.tagName).toBe('P');
    expect(explanation).toHaveTextContent(/quick contrasts after reviewing the default household/i);
  });

  it.each(STARTER_TEMPLATES)('loads $label into the scenario store and confirms the selection', (template) => {
    render(<StarterTemplateChooser />);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(escapeRegExp(template.label), 'i') }));

    expect(useScenarioStore.getState().formValues).toEqual({
      ...DEFAULT_BASIC_FORM_VALUES,
      ...template.formValues,
    });

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(`Loaded '${template.label}'`);
    expect(status).toHaveTextContent(/change any field to customize/i);
  });

  it('dismisses the success banner after five seconds', () => {
    const rothLadderTemplate = STARTER_TEMPLATES[1];
    render(<StarterTemplateChooser />);

    fireEvent.click(screen.getByRole('button', { name: /roth ladder bridge/i }));

    expect(screen.getByRole('status')).toHaveTextContent(`Loaded '${rothLadderTemplate.label}'`);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('cleans up an active confirmation timer on unmount', () => {
    const { unmount } = render(<StarterTemplateChooser />);

    fireEvent.click(screen.getByRole('button', { name: /brokerage bridge with 72\(t\) context/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('refreshes the mounted basic planner form when a template is loaded', () => {
    const rothLadderTemplate = STARTER_TEMPLATES[1];
    const initialProjectionResults = useScenarioStore.getState().projectionResults;

    render(<BasicPlannerPage />);

    fireEvent.click(screen.getByRole('button', { name: /roth ladder bridge/i }));

    expect(useScenarioStore.getState().formValues).toEqual({
      ...DEFAULT_BASIC_FORM_VALUES,
      ...rothLadderTemplate.formValues,
    });
    expect(useScenarioStore.getState().projectionResults).not.toBe(initialProjectionResults);
    expect(screen.getByLabelText('State')).toHaveValue(rothLadderTemplate.formValues.stateCode);
    expect(screen.getByLabelText('Annual spending')).toHaveValue(
      String(rothLadderTemplate.formValues.annualSpendingToday),
    );
    expect(screen.getByLabelText('Annual mortgage P&I')).toHaveValue(
      String(rothLadderTemplate.formValues.annualMortgagePAndI),
    );
    expect(screen.getByLabelText('Auto-deplete brokerage')).toBeChecked();
  });
});
