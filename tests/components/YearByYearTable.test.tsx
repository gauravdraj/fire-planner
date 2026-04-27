import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { YearByYearTable } from '@/components/YearByYearTable';
import { CONSTANTS_2026 } from '@/core/constants/2026';
import type { AccountBalances, YearBreakdown } from '@/core/projection';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const ZERO_BALANCES: AccountBalances = {
  cash: 0,
  taxableBrokerage: 0,
  traditional: 0,
  roth: 0,
};

const TABLE_FIXTURE: readonly YearBreakdown[] = [
  buildYearBreakdown({
    afterTaxCashFlow: 12_000,
    agi: 70_000,
    closingBalances: {
      cash: 10_000,
      taxableBrokerage: 20_000,
      traditional: 30_000,
      roth: 40_000,
    },
    niit: 123,
    seTax: 456,
    totalTax: 11_000,
    withdrawals: {
      cash: 1_000,
      taxableBrokerage: 2_000,
      traditional: 3_000,
      roth: 4_000,
    },
    year: 2026,
  }),
  buildYearBreakdown({
    afterTaxCashFlow: 12_360,
    agi: 72_100,
    closingBalances: {
      cash: 10_300,
      taxableBrokerage: 20_600,
      traditional: 30_900,
      roth: 41_200,
    },
    niit: 234,
    seTax: 567,
    totalTax: 11_330,
    withdrawals: {
      cash: 1_030,
      taxableBrokerage: 2_060,
      traditional: 3_090,
      roth: 4_120,
    },
    year: 2027,
  }),
];

function dateAtTaxDataAge(ageDays: number): string {
  const date = new Date(`${CONSTANTS_2026.retrievedAt}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + ageDays);

  return date.toISOString().slice(0, 10);
}

function buildYearBreakdown(
  values: Pick<YearBreakdown, 'afterTaxCashFlow' | 'agi' | 'closingBalances' | 'niit' | 'seTax' | 'totalTax' | 'withdrawals' | 'year'>,
): YearBreakdown {
  return {
    year: values.year,
    spending: 0,
    openingBalances: ZERO_BALANCES,
    withdrawals: values.withdrawals,
    conversions: 0,
    brokerageHarvests: 0,
    gainsOrLosses: ZERO_BALANCES,
    brokerageBasis: {
      opening: 0,
      sold: 0,
      realizedGainOrLoss: 0,
      closing: 0,
    },
    agi: values.agi,
    acaMagi: 999_001,
    irmaaMagi: 999_002,
    federalTax: 0,
    stateTax: 0,
    ltcgTax: 0,
    niit: values.niit,
    seTax: values.seTax,
    qbiDeduction: 0,
    taxableSocialSecurity: 0,
    acaPremiumCredit: null,
    aptcReconciliation: null,
    irmaaPremium: null,
    totalTax: values.totalTax,
    afterTaxCashFlow: values.afterTaxCashFlow,
    warnings: [],
    closingBalances: values.closingBalances,
  };
}

function installFixtureState() {
  const current = useScenarioStore.getState();

  useScenarioStore.setState({
    formValues: {
      ...current.formValues,
      currentYear: 2026,
      primaryAge: 60,
    },
    projectionResults: TABLE_FIXTURE,
    scenario: {
      ...current.scenario,
      inflationRate: 0.03,
      startYear: 2026,
    },
  });
}

function rowForYear(year: number): HTMLElement {
  return screen.getByRole('rowheader', { name: String(year) }).closest('tr') as HTMLElement;
}

describe('YearByYearTable', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
    installFixtureState();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the basic table headers inside a horizontal scroller with a sticky first column', () => {
    const { container } = render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    expect(screen.getByRole('heading', { name: 'Year-by-year projection' })).toBeInTheDocument();
    expect(container.querySelector('.overflow-x-auto')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Year' })).toHaveClass('sticky', 'left-0');
    expect(screen.getByRole('columnheader', { name: 'Age' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total withdrawals' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'AGI' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total tax' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'After-tax cash flow' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ending balance' })).toBeInTheDocument();
  });

  it('renders rows from store-provided YearBreakdown values without audit-detail columns', () => {
    useUiStore.getState().setDisplayUnit('nominal');

    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    const row2027 = rowForYear(2027);

    expect(within(row2027).getByText('61')).toHaveClass('text-right', 'tabular-nums');
    expect(within(row2027).getByText('$10,300')).toHaveClass('text-right', 'tabular-nums');
    expect(within(row2027).getByText('$72,100')).toBeInTheDocument();
    expect(within(row2027).getByText('$11,330')).toBeInTheDocument();
    expect(within(row2027).getByText('$12,360')).toBeInTheDocument();
    expect(within(row2027).getByText('$103,000')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /roth conversions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /federal tax/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /state tax/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /ltcg tax/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /niit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /se tax/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /aca magi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /irmaa magi/i })).not.toBeInTheDocument();
    expect(screen.queryByText('$234')).not.toBeInTheDocument();
    expect(screen.queryByText('$567')).not.toBeInTheDocument();
    expect(screen.queryByText('$999,001')).not.toBeInTheDocument();
    expect(screen.queryByText('$999,002')).not.toBeInTheDocument();
  });

  it('converts displayed monetary values between real and nominal dollars', () => {
    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    const realRow = rowForYear(2027);
    expect(within(realRow).getByText('$10,000')).toBeInTheDocument();
    expect(within(realRow).getByText('$70,000')).toBeInTheDocument();
    expect(within(realRow).getByText('$100,000')).toBeInTheDocument();

    cleanup();
    useUiStore.getState().setDisplayUnit('nominal');

    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    const nominalRow = rowForYear(2027);
    expect(within(nominalRow).getByText('$10,300')).toBeInTheDocument();
    expect(within(nominalRow).getByText('$72,100')).toBeInTheDocument();
    expect(within(nominalRow).getByText('$103,000')).toBeInTheDocument();
  });

  it('marks all output rows and cells stale for soft and hard tax-data staleness', () => {
    const { rerender } = render(<YearByYearTable now={dateAtTaxDataAge(540)} />);

    for (const row of screen.getAllByRole('row').slice(1)) {
      expect(row).toHaveAttribute('data-stale', 'true');
      expect(within(row).getByRole('rowheader')).toHaveAttribute('data-stale', 'true');
      for (const cell of within(row).getAllByRole('cell')) {
        expect(cell).toHaveAttribute('data-stale', 'true');
      }
    }

    rerender(<YearByYearTable now={dateAtTaxDataAge(900)} />);

    expect(rowForYear(2027)).toHaveAttribute('data-stale', 'true');
  });
});
