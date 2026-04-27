import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { InfoTooltip } from '@/components/InfoTooltip';

describe('InfoTooltip', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a described info glyph with CSS-hidden tooltip content initially', () => {
    render(<InfoTooltip ariaLabel="Explain AGI">Adjusted gross income before MAGI adjustments.</InfoTooltip>);

    const trigger = screen.getByRole('button', { name: 'Explain AGI' });
    const tooltip = screen.getByRole('tooltip');

    expect(trigger).toHaveTextContent('i');
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    expect(trigger).toHaveClass('peer');
    expect(trigger.parentElement).toHaveClass('group');
    expect(tooltip).not.toHaveAttribute('hidden');
    expect(tooltip).toHaveClass('invisible', 'opacity-0');
  });

  it('wires mouse hover to peer and group visibility classes', () => {
    render(<InfoTooltip ariaLabel="Explain ACA MAGI">MAGI used for ACA premium tax credit eligibility.</InfoTooltip>);

    const trigger = screen.getByRole('button', { name: 'Explain ACA MAGI' });
    const tooltip = screen.getByRole('tooltip');

    fireEvent.mouseEnter(trigger);

    expect(tooltip).toHaveTextContent('MAGI used for ACA premium tax credit eligibility.');
    expect(tooltip).toHaveClass(
      'peer-hover:visible',
      'peer-hover:opacity-100',
      'group-hover:visible',
      'group-hover:opacity-100',
    );

    fireEvent.mouseLeave(trigger);

    expect(tooltip).toHaveClass('invisible', 'opacity-0');
  });

  it('wires keyboard focus to peer and group visibility classes', () => {
    render(<InfoTooltip ariaLabel="Explain withdrawal rate">Withdrawals divided by prior year balance.</InfoTooltip>);

    const trigger = screen.getByRole('button', { name: 'Explain withdrawal rate' });
    const tooltip = screen.getByRole('tooltip');

    trigger.focus();
    fireEvent.focus(trigger);

    expect(trigger).toHaveFocus();
    expect(tooltip).toHaveTextContent('Withdrawals divided by prior year balance.');
    expect(tooltip).toHaveClass(
      'peer-focus:visible',
      'peer-focus:opacity-100',
      'group-focus-within:visible',
      'group-focus-within:opacity-100',
    );
  });

  it('keeps dismissal on blur and focus movement rather than React Escape state', () => {
    render(<InfoTooltip ariaLabel="Explain federal tax">Federal ordinary income tax before other tax components.</InfoTooltip>);

    const trigger = screen.getByRole('button', { name: 'Explain federal tax' });
    const tooltip = screen.getByRole('tooltip');

    trigger.focus();
    fireEvent.focus(trigger);
    expect(trigger).toHaveFocus();

    trigger.blur();
    fireEvent.blur(trigger);

    expect(trigger).not.toHaveFocus();
    expect(tooltip).not.toHaveAttribute('hidden');
    expect(tooltip).toHaveClass('invisible', 'opacity-0');
  });
});
