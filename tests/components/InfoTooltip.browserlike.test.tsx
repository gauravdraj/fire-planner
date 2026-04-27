import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { InfoTooltip } from '@/components/InfoTooltip';

describe('InfoTooltip browserlike visibility wiring', () => {
  afterEach(() => {
    cleanup();
  });

  it('uses peer and group hover classes without hidden markup or React state toggles', () => {
    render(<InfoTooltip ariaLabel="Explain ACA MAGI">MAGI used for ACA premium tax credit eligibility.</InfoTooltip>);

    const trigger = screen.getByRole('button', { name: 'Explain ACA MAGI' });
    const tooltip = screen.getByRole('tooltip');

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseLeave(trigger);

    expect(trigger).toHaveClass('peer');
    expect(trigger.nextElementSibling).toBe(tooltip);
    expect(tooltip).not.toHaveAttribute('hidden');
    expect(tooltip).toHaveClass(
      'invisible',
      'opacity-0',
      'peer-hover:visible',
      'peer-hover:opacity-100',
      'group-hover:visible',
      'group-hover:opacity-100',
      'peer-focus:visible',
      'peer-focus:opacity-100',
    );
  });

  it('shows on hover and hides on unhover through the CSS peer selectors', () => {
    render(<InfoTooltip ariaLabel="Explain ACA MAGI">MAGI used for ACA premium tax credit eligibility.</InfoTooltip>);

    const trigger = screen.getByRole('button', { name: 'Explain ACA MAGI' });
    const tooltip = screen.getByRole('tooltip');

    syncTooltipVisibility(trigger, tooltip);

    expect(tooltip).not.toHaveAttribute('hidden');
    expect(tooltip).not.toBeVisible();

    fireEvent.mouseEnter(trigger);
    syncTooltipVisibility(trigger, tooltip, { hoveredElement: trigger });

    expect(tooltip).toBeVisible();

    fireEvent.mouseLeave(trigger);
    syncTooltipVisibility(trigger, tooltip);

    expect(tooltip).not.toBeVisible();
  });

  it('shows on keyboard focus and hides on blur through CSS focus selectors', () => {
    render(<InfoTooltip ariaLabel="Explain ACA MAGI">MAGI used for ACA premium tax credit eligibility.</InfoTooltip>);

    const trigger = screen.getByRole('button', { name: 'Explain ACA MAGI' });
    const tooltip = screen.getByRole('tooltip');

    syncTooltipVisibility(trigger, tooltip);

    expect(tooltip).not.toHaveAttribute('hidden');
    expect(tooltip).not.toBeVisible();

    trigger.focus();
    fireEvent.focus(trigger);
    syncTooltipVisibility(trigger, tooltip);

    expect(trigger).toHaveFocus();
    expect(tooltip).toBeVisible();

    trigger.blur();
    fireEvent.blur(trigger);
    syncTooltipVisibility(trigger, tooltip);

    expect(trigger).not.toHaveFocus();
    expect(tooltip).not.toBeVisible();
  });
});

function syncTooltipVisibility(
  trigger: HTMLElement,
  tooltip: HTMLElement,
  { hoveredElement = null }: Readonly<{ hoveredElement?: Element | null }> = {},
) {
  const wrapper = trigger.parentElement;
  const isPeerHover = hoveredElement === trigger && tooltip.classList.contains('peer-hover:visible');
  const isGroupHover =
    hoveredElement !== null &&
    wrapper?.contains(hoveredElement) === true &&
    tooltip.classList.contains('group-hover:visible');
  const isPeerFocus = trigger.matches(':focus') && tooltip.classList.contains('peer-focus:visible');
  const activeElement = trigger.ownerDocument.activeElement;
  const isGroupFocusWithin =
    activeElement instanceof Element &&
    wrapper?.contains(activeElement) === true &&
    tooltip.classList.contains('group-focus-within:visible');
  const isShown = isPeerHover || isGroupHover || isPeerFocus || isGroupFocusWithin;

  tooltip.style.visibility = isShown ? 'visible' : 'hidden';
  tooltip.style.opacity = isShown ? '1' : '0';
}
