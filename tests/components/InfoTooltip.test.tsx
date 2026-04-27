import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { InfoTooltip } from '@/components/InfoTooltip';

describe('InfoTooltip', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a described info glyph with hidden tooltip content initially', () => {
    render(<InfoTooltip ariaLabel="Explain AGI">Adjusted gross income before MAGI adjustments.</InfoTooltip>);

    const trigger = screen.getByRole('button', { name: 'Explain AGI' });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    expect(trigger).toHaveTextContent('i');
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    expect(tooltip).toHaveAttribute('hidden');
    expect(tooltip).not.toBeVisible();
  });

  it('shows tooltip content on mouse hover', () => {
    render(<InfoTooltip ariaLabel="Explain ACA MAGI">MAGI used for ACA premium tax credit eligibility.</InfoTooltip>);

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Explain ACA MAGI' }));

    const tooltip = screen.getByRole('tooltip');

    expect(tooltip).toHaveTextContent('MAGI used for ACA premium tax credit eligibility.');
    expect(tooltip).not.toHaveAttribute('hidden');
    expect(tooltip).toBeVisible();
  });

  it('shows tooltip content on keyboard focus', () => {
    render(<InfoTooltip ariaLabel="Explain withdrawal rate">Withdrawals divided by prior year balance.</InfoTooltip>);

    const trigger = screen.getByRole('button', { name: 'Explain withdrawal rate' });
    trigger.focus();
    fireEvent.focus(trigger);

    expect(trigger).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Withdrawals divided by prior year balance.');
  });

  it('dismisses focused tooltip content with Escape', () => {
    render(<InfoTooltip ariaLabel="Explain federal tax">Federal ordinary income tax before other tax components.</InfoTooltip>);

    const trigger = screen.getByRole('button', { name: 'Explain federal tax' });
    trigger.focus();
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeVisible();

    fireEvent.keyDown(trigger, { key: 'Escape' });

    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(trigger).toHaveFocus();
    expect(tooltip).toHaveAttribute('hidden');
    expect(tooltip).not.toBeVisible();
  });
});
