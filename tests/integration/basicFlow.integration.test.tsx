import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SHARE_LINK_PRIVACY_TEXT } from '@/components/ShareLinkModal';

import { installMemoryLocalStorage } from '../store/memoryStorage';

let clipboardWrites: string[];
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

async function importApp() {
  const { App } = await import('@/App');

  return App;
}

function installClipboardMock() {
  clipboardWrites = [];

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        clipboardWrites.push(text);
      },
    },
  });
}

function changeField(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillRealisticMfjScenario() {
  changeField('Filing status', 'mfj');
  changeField('State', 'FL');
  changeField('Primary age', '58');
  changeField('Partner age', '56');
  changeField('Retirement target year', '2032');
  changeField('Plan-end age', '90');
  changeField('Annual spending', '90000');
  changeField('Traditional balance', '1800000');
  changeField('Roth balance', '750000');
  changeField('Brokerage plus cash balance', '1600000');
  changeField('Weighted-average taxable basis', '1200000');
  changeField('W-2 income', '240000');
  changeField('Net consulting income', '20000');
  changeField('Net rental income', '18000');
  changeField('Social Security annual benefit', '60000');
  changeField('Social Security claim age', '67');
  changeField('Pension/annuity annual amount', '30000');
  changeField('Healthcare phase', 'aca');
}

function summaryCard(name: RegExp) {
  return screen.getByRole('article', { name });
}

function summaryValue(name: RegExp): string {
  const card = summaryCard(name);

  return within(card).getByText(/^-?\$[\d,]+$/).textContent ?? '';
}

function numericMoney(value: string): number {
  return Number(value.replace(/[^-\d]/g, ''));
}

describe('basic Gate 3 app flow', () => {
  beforeEach(() => {
    vi.resetModules();
    installMemoryLocalStorage();
    installClipboardMock();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.history.replaceState(null, '', '/planner?case=gate3');
  });

  afterEach(() => {
    cleanup();
    consoleErrorSpy.mockRestore();
  });

  it('runs a realistic MFJ scenario through the full app and verifies layout, results, and share behavior', async () => {
    const App = await importApp();
    const { container } = render(<App />);

    const form = screen.getByRole('form', { name: /basic scenario form/i });

    expect(form).toHaveClass('grid', 'gap-4', 'sm:grid-cols-2');
    expect(form).not.toHaveClass('grid-cols-2');

    fillRealisticMfjScenario();
    fireEvent.click(screen.getByRole('button', { name: /run projection/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Scenario updated.');
    expect(screen.getByRole('heading', { name: /projection summary/i })).toBeInTheDocument();
    expect(numericMoney(summaryValue(/net worth at retirement/i))).toBeGreaterThan(0);
    expect(numericMoney(summaryValue(/plan-end balance/i))).toBeGreaterThan(0);
    expect(within(summaryCard(/years funded/i)).getByText(/\d+ years?/)).toHaveTextContent(/year/);

    const summaryGrid = screen.getByRole('heading', { name: /projection summary/i }).parentElement?.querySelector('.grid');

    expect(summaryGrid).toHaveClass('grid', 'gap-3', 'md:grid-cols-3');
    expect(summaryGrid).not.toHaveClass('grid-cols-3', 'sm:grid-cols-3');

    const table = screen.getByRole('table');
    const expectedProjectionYears = 90 - 58 + 1;

    expect(within(table).getAllByRole('row')).toHaveLength(expectedProjectionYears + 1);

    const scrollableRegions = container.querySelectorAll('.overflow-x-auto');
    expect(scrollableRegions).toHaveLength(1);
    expect(scrollableRegions[0]?.querySelector('table')).toBe(table);
    expect(within(table).getByRole('columnheader', { name: 'Year' })).toHaveClass('sticky', 'left-0');
    expect(within(table).getAllByRole('rowheader')[0]).toHaveClass('sticky', 'left-0');

    const realRetirementValue = summaryValue(/net worth at retirement/i);
    fireEvent.click(screen.getByRole('button', { name: 'Nominal dollars' }));

    expect(summaryValue(/net worth at retirement/i)).not.toBe(realRetirementValue);

    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));

    expect(screen.getByRole('dialog', { name: /share-link privacy/i })).toBeInTheDocument();
    expect(screen.getByText(SHARE_LINK_PRIVACY_TEXT)).toBeInTheDocument();
    expect(clipboardWrites).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /copy share link/i }));

    await waitFor(() => expect(clipboardWrites).toHaveLength(1));

    expect(new URL(clipboardWrites[0] ?? '').hash).toMatch(/^#v1:/);
    expect(screen.queryByRole('dialog', { name: /share-link privacy/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));

    await waitFor(() => expect(clipboardWrites).toHaveLength(2));

    expect(screen.queryByRole('dialog', { name: /share-link privacy/i })).not.toBeInTheDocument();
    expect(new URL(clipboardWrites[1] ?? '').hash).toMatch(/^#v1:/);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
