import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SHARE_LINK_PRIVACY_TEXT } from '@/components/ShareLinkModal';

import { installMemoryLocalStorage } from '../store/memoryStorage';

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ReferenceArea: () => null,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

let clipboardWrites: string[];
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const SLOW_UI_INTEGRATION_TIMEOUT_MS = 20_000;

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
  changeField('HSA balance', '85000');
  changeField('W-2 income', '240000');
  changeField('Net consulting income', '20000');
  changeField('Net rental income', '18000');
  changeField('Social Security annual benefit', '60000');
  changeField('Social Security claim age', '67');
  changeField('Pension/annuity annual amount', '30000');
  changeField('Healthcare phase', 'aca');
}

function advanceLiveDebounce() {
  act(() => {
    vi.advanceTimersByTime(151);
  });
}

function advancePulseDuration() {
  act(() => {
    vi.advanceTimersByTime(700);
  });
}

function liveStat(id: string) {
  return screen.getByTestId(`live-stat-${id}`);
}

function liveStatValue(id: string): string {
  return liveStat(id).querySelector('.tabular-nums')?.textContent ?? '';
}

function numericMoney(value: string): number {
  return Number(value.replace(/[^-\d]/g, ''));
}

function expectedFplClassForPercent(percentLabel: string): readonly string[] {
  const percentage = Number(percentLabel.replace('%', '')) / 100;

  if (percentage < 1.38) {
    return ['bg-rose-100', 'text-rose-800'];
  }
  if (percentage < 2) {
    return ['bg-amber-50', 'text-amber-800'];
  }
  if (percentage < 3) {
    return ['bg-emerald-100', 'text-emerald-900'];
  }
  if (percentage <= 4) {
    return ['bg-amber-100', 'text-amber-900'];
  }

  return ['bg-rose-200', 'text-rose-950', 'font-bold'];
}

function firstBridgeFplCell(table: HTMLElement): HTMLElement {
  const bodyRows = Array.from(table.querySelectorAll('tbody tr')) as HTMLElement[];
  const bridgeRow = bodyRows.find((row) => {
    const phaseCell = row.querySelector('[data-testid$="-phase"]');
    const fplCell = row.querySelector('[data-testid$="-fplPercentage"]');

    return phaseCell?.textContent?.includes('Bridge') === true && fplCell?.textContent?.includes('%') === true;
  });

  if (bridgeRow === undefined) {
    throw new Error('Expected at least one bridge year with an FPL percentage cell.');
  }

  return bridgeRow.querySelector('[data-testid$="-fplPercentage"]') as HTMLElement;
}

async function renderFilledRealisticPlanner() {
  const App = await importApp();
  const result = render(<App />);

  vi.useFakeTimers();
  fillRealisticMfjScenario();
  advanceLiveDebounce();
  advancePulseDuration();
  vi.useRealTimers();

  return {
    container: result.container,
    form: screen.getByRole('form', { name: /basic scenario form/i }),
    table: screen.getByRole('table'),
  };
}

async function renderFilledRealisticPlannerWithFakeTimers() {
  const App = await importApp();
  const result = render(<App />);

  vi.useFakeTimers();
  fillRealisticMfjScenario();
  advanceLiveDebounce();

  return {
    container: result.container,
    form: screen.getByRole('form', { name: /basic scenario form/i }),
    table: screen.getByRole('table'),
  };
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
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  it('runs a realistic MFJ scenario through the full app and verifies layout, results, and share behavior', async () => {
    const App = await importApp();
    const { container } = render(<App />);

    const form = screen.getByRole('form', { name: /basic scenario form/i });

    expect(form).toHaveClass('grid', 'gap-4', 'sm:grid-cols-2');
    expect(form).not.toHaveClass('grid-cols-2');

    vi.useFakeTimers();
    fillRealisticMfjScenario();
    advanceLiveDebounce();
    advancePulseDuration();
    vi.useRealTimers();

    expect(screen.queryByRole('heading', { name: /projection summary/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/live projection stats/i)).toBeInTheDocument();
    expect(numericMoney(liveStatValue('net-worth-at-retirement'))).toBeGreaterThan(0);
    expect(numericMoney(liveStatValue('plan-end-balance'))).toBeGreaterThan(0);
    expect(within(liveStat('years-funded')).getByText(/\d+ years?/)).toHaveTextContent(/year/);

    const table = screen.getByRole('table');
    const expectedProjectionYears = 90 - 58 + 1;

    expect(within(table).getAllByRole('row')).toHaveLength(expectedProjectionYears + 2);

    const tableScrollRegion = table.closest('.overflow-x-auto');

    expect(tableScrollRegion).not.toBeNull();
    expect(tableScrollRegion?.querySelector('table')).toBe(table);
    expect(within(table).getByRole('columnheader', { name: 'Year' })).toHaveClass('sticky', 'left-0');
    expect(within(table).getAllByRole('rowheader')[0]).toHaveClass('sticky', 'left-0');

    const realRetirementValue = liveStatValue('net-worth-at-retirement');
    fireEvent.click(screen.getByRole('button', { name: 'Nominal dollars' }));

    expect(liveStatValue('net-worth-at-retirement')).not.toBe(realRetirementValue);

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
  }, SLOW_UI_INTEGRATION_TIMEOUT_MS);

  it('pulses a live stat cell after typing into annual spending', async () => {
    await renderFilledRealisticPlannerWithFakeTimers();
    advancePulseDuration();

    changeField('Annual spending', '95000');
    advanceLiveDebounce();

    const liveStats = within(screen.getByLabelText(/live projection stats/i)).getAllByRole('listitem');

    expect(liveStats.some((stat) => stat.classList.contains('bg-yellow-100'))).toBe(true);
  }, SLOW_UI_INTEGRATION_TIMEOUT_MS);

  it('updates plan-end balance after editing traditional expected return', async () => {
    await renderFilledRealisticPlannerWithFakeTimers();

    const planEndBalanceBefore = numericMoney(liveStatValue('plan-end-balance'));

    changeField('Traditional expected return', '0');
    advanceLiveDebounce();

    expect(numericMoney(liveStatValue('plan-end-balance'))).toBeLessThan(planEndBalanceBefore);
  }, SLOW_UI_INTEGRATION_TIMEOUT_MS);

  it('updates the retirement target derived chip after typing into the field', async () => {
    await renderFilledRealisticPlannerWithFakeTimers();

    expect(screen.getByText('→ Age 64 in 6 yrs')).toBeInTheDocument();

    changeField('Retirement target year', '2031');
    advanceLiveDebounce();

    expect(screen.getByText('→ Age 63 in 5 yrs')).toBeInTheDocument();
    expect(screen.queryByText('→ Age 64 in 6 yrs')).not.toBeInTheDocument();
  }, SLOW_UI_INTEGRATION_TIMEOUT_MS);

  it('renders the five grouped year-table band labels', async () => {
    const { container } = await renderFilledRealisticPlanner();

    expect(Array.from(container.querySelectorAll('thead tr:first-child th')).map((header) => header.textContent)).toEqual([
      'Identity',
      'Balances',
      'Income',
      'Tax',
      'KPIs',
    ]);
  }, SLOW_UI_INTEGRATION_TIMEOUT_MS);

  it('renders a dense year-table row with at least eighteen per-year columns', async () => {
    const { container, table } = await renderFilledRealisticPlanner();
    const perYearColumnCount = container.querySelectorAll('thead tr:nth-child(2) th').length;
    const firstDataRow = within(table).getAllByRole('row')[2] as HTMLElement;

    expect(perYearColumnCount).toBeGreaterThanOrEqual(18);
    expect(within(firstDataRow).getAllByRole('cell').length + within(firstDataRow).getAllByRole('rowheader').length).toBe(
      perYearColumnCount,
    );
  }, SLOW_UI_INTEGRATION_TIMEOUT_MS);

  it('colors a bridge-year FPL percentage cell with its threshold class', async () => {
    const { table } = await renderFilledRealisticPlanner();
    const bridgeFplCell = firstBridgeFplCell(table);
    const bridgeFplMetric = bridgeFplCell.querySelector('span') as HTMLElement;
    const bridgeFplValue = bridgeFplMetric.textContent ?? '';

    expect(bridgeFplMetric).toHaveClass(...expectedFplClassForPercent(bridgeFplValue));
  }, SLOW_UI_INTEGRATION_TIMEOUT_MS);

  it('renders basic-form fieldsets with the expected legends', async () => {
    const { form } = await renderFilledRealisticPlanner();
    const fieldsets = Array.from(form.querySelectorAll('fieldset')) as HTMLElement[];

    expect(fieldsets).toHaveLength(8);
    expect(
      fieldsets.map((fieldset) =>
        within(fieldset)
          .getByRole('button', {
            name: /^About (Household|Timeline|Spending & debt|Accounts|Growth & dividends|Withdrawal strategy|Income|Healthcare)$/,
          })
          .getAttribute('aria-label')
          ?.replace('About ', ''),
      ),
    ).toEqual([
      'Household',
      'Timeline',
      'Spending & debt',
      'Accounts',
      'Growth & dividends',
      'Withdrawal strategy',
      'Income',
      'Healthcare',
    ]);
  }, SLOW_UI_INTEGRATION_TIMEOUT_MS);

  it('renders at least twenty info tooltip glyphs across the planner page', async () => {
    await renderFilledRealisticPlanner();

    expect(screen.getAllByRole('button', { name: /About / }).length).toBeGreaterThanOrEqual(20);
  }, SLOW_UI_INTEGRATION_TIMEOUT_MS);

  it('keeps the rich year table horizontally scrollable with sticky year headers', async () => {
    const { container, table } = await renderFilledRealisticPlanner();
    const tableScrollRegion = table.closest('.overflow-x-auto');

    expect(tableScrollRegion).not.toBeNull();
    expect(tableScrollRegion?.querySelector('table')).toBe(table);
    expect(within(table).getByRole('columnheader', { name: 'Year' })).toHaveClass('sticky', 'left-0');
    expect(within(table).getAllByRole('rowheader')[0]).toHaveClass('sticky', 'left-0');
  }, SLOW_UI_INTEGRATION_TIMEOUT_MS);

  it('continues to update live stat values when display units change', async () => {
    await renderFilledRealisticPlanner();

    const realRetirementValue = liveStatValue('net-worth-at-retirement');
    fireEvent.click(screen.getByRole('button', { name: 'Nominal dollars' }));

    expect(liveStatValue('net-worth-at-retirement')).not.toBe(realRetirementValue);
  }, SLOW_UI_INTEGRATION_TIMEOUT_MS);
});
