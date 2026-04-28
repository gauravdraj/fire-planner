import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StalenessGate, staleAcknowledgementKey } from '@/components/StalenessGate';
import { CONSTANTS_2026 } from '@/core/constants/2026';

import { installMemoryLocalStorage } from '../store/memoryStorage';

function dateAtAge(ageDays: number): string {
  const date = new Date(`${CONSTANTS_2026.retrievedAt}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + ageDays);

  return date.toISOString().slice(0, 10);
}

describe('StalenessGate', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders no warning before the soft-stale threshold', () => {
    render(<StalenessGate now={dateAtAge(539)} />);

    expect(screen.queryByRole('status', { name: /tax data staleness warning/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the soft warning banner at 540 days', () => {
    render(<StalenessGate now={dateAtAge(540)} />);
    const bannerShell = screen.getByText('Tax data may be getting stale.').closest('div');

    expect(screen.getByRole('status', { name: /tax data staleness warning/i })).toHaveTextContent(
      'Tax data may be getting stale.',
    );
    expect(bannerShell).toHaveClass('lg:max-w-6xl', 'xl:max-w-7xl');
    expect(screen.getByText(/is 540 days old/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a hard-stale modal at 900 days and stores a retrieval-date acknowledgement', () => {
    render(<StalenessGate now={dateAtAge(900)} />);

    expect(screen.getByRole('status', { name: /tax data staleness warning/i })).toHaveTextContent(
      'Tax data is stale.',
    );
    expect(screen.getByRole('dialog', { name: /tax data is stale/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acknowledge and continue/i })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: /acknowledge and continue/i }));

    expect(window.localStorage.getItem(staleAcknowledgementKey(CONSTANTS_2026.retrievedAt))).toBe('true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not show the hard-stale modal when the scoped acknowledgement exists', () => {
    window.localStorage.setItem(staleAcknowledgementKey(CONSTANTS_2026.retrievedAt), 'true');

    render(<StalenessGate now={dateAtAge(900)} />);

    expect(screen.getByRole('status', { name: /tax data staleness warning/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
