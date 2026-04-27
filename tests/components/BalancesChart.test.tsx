import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  BalancesChart,
  BalancesChartTooltip,
  buildBalancesChartData,
  formatCompactDollarTick,
} from '@/components/BalancesChart';
import { CONSTANTS_2026 } from '@/core/constants/2026';
import type { AccountBalances, YearBreakdown } from '@/core/projection';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const ZERO_BALANCES: AccountBalances = {
  cash: 0,
  hsa: 0,
  taxableBrokerage: 0,
  traditional: 0,
  roth: 0,
};

const CHART_FIXTURE: readonly YearBreakdown[] = [
  buildYearBreakdown({
    closingBalances: {
      cash: 10_000,
      hsa: 15_000,
      taxableBrokerage: 20_000,
      traditional: 30_000,
      roth: 40_000,
    },
    year: 2026,
  }),
  buildYearBreakdown({
    closingBalances: {
      cash: 10_300,
      hsa: 15_450,
      taxableBrokerage: 20_600,
      traditional: 30_900,
      roth: 41_200,
    },
    year: 2027,
  }),
];

function dateAtTaxDataAge(ageDays: number): string {
  const date = new Date(`${CONSTANTS_2026.retrievedAt}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + ageDays);

  return date.toISOString().slice(0, 10);
}

function buildYearBreakdown(values: Pick<YearBreakdown, 'closingBalances' | 'year'>): YearBreakdown {
  return {
    year: values.year,
    spending: 0,
    openingBalances: ZERO_BALANCES,
    withdrawals: ZERO_BALANCES,
    conversions: 0,
    brokerageHarvests: 0,
    gainsOrLosses: ZERO_BALANCES,
    brokerageBasis: {
      opening: 0,
      sold: 0,
      realizedGainOrLoss: 0,
      closing: 0,
    },
    agi: 0,
    acaMagi: 0,
    irmaaMagi: 0,
    federalTax: 0,
    stateTax: 0,
    ltcgTax: 0,
    niit: 0,
    seTax: 0,
    qbiDeduction: 0,
    taxableSocialSecurity: 0,
    acaPremiumCredit: null,
    aptcReconciliation: null,
    irmaaPremium: null,
    totalTax: 0,
    afterTaxCashFlow: 0,
    warnings: [],
    closingBalances: values.closingBalances,
  };
}

function installFixtureState() {
  const current = useScenarioStore.getState();

  useScenarioStore.setState({
    projectionResults: CHART_FIXTURE,
    scenario: {
      ...current.scenario,
      inflationRate: 0.03,
      startYear: 2026,
    },
  });
}

describe('BalancesChart', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
    installFixtureState();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a stacked Recharts area chart for engine-supported account balances', () => {
    const { container } = render(<BalancesChart now={dateAtTaxDataAge(0)} />);

    expect(screen.getByRole('heading', { name: 'Account balances' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /stacked account balances/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.recharts-area')).toHaveLength(5);
    expect(screen.getByText('Traditional')).toBeInTheDocument();
    expect(screen.getByText('Roth')).toBeInTheDocument();
    expect(screen.getByText('HSA')).toBeInTheDocument();
    expect(screen.getByText('Taxable brokerage')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
  });

  it('builds nominal and real chart points with all supported series', () => {
    const state = useScenarioStore.getState();

    const nominal = buildBalancesChartData({
      displayUnit: 'nominal',
      projectionResults: CHART_FIXTURE,
      scenario: state.scenario,
    });
    const real = buildBalancesChartData({
      displayUnit: 'real',
      projectionResults: CHART_FIXTURE,
      scenario: state.scenario,
    });

    expect(Object.keys(nominal[0] ?? {}).sort()).toEqual(
      ['cash', 'hsa', 'roth', 'taxableBrokerage', 'total', 'traditional', 'year'].sort(),
    );
    expect(nominal[1]).toMatchObject({
      cash: 10_300,
      hsa: 15_450,
      roth: 41_200,
      taxableBrokerage: 20_600,
      total: 118_450,
      traditional: 30_900,
      year: 2027,
    });
    expect(real[1]).toMatchObject({
      cash: 10_000,
      hsa: 15_000,
      roth: 40_000,
      taxableBrokerage: 20_000,
      total: 115_000,
      traditional: 30_000,
      year: 2027,
    });
  });

  it('uses compact dollar labels for the Y axis', () => {
    expect(formatCompactDollarTick(1_200)).toBe('$1.2k');
    expect(formatCompactDollarTick(3_400_000)).toBe('$3.4M');
    expect(formatCompactDollarTick(500)).toBe('$500');
  });

  it('shows per-bucket tooltip values and a total', () => {
    render(
      <BalancesChartTooltip
        active
        label={2027}
        payload={[
          { dataKey: 'cash', value: 10_000 },
          { dataKey: 'hsa', value: 15_000 },
          { dataKey: 'taxableBrokerage', value: 20_000 },
          { dataKey: 'traditional', value: 30_000 },
          { dataKey: 'roth', value: 40_000 },
        ]}
      />,
    );

    expect(screen.getByText('2027')).toBeInTheDocument();
    expect(screen.getByText('Traditional')).toBeInTheDocument();
    expect(screen.getByText('Roth')).toBeInTheDocument();
    expect(screen.getByText('HSA')).toBeInTheDocument();
    expect(screen.getByText('Taxable brokerage')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$115,000')).toBeInTheDocument();
  });

  it('marks the chart container stale for soft and hard tax-data staleness', () => {
    const { rerender } = render(<BalancesChart now={dateAtTaxDataAge(540)} />);
    const chart = screen.getByRole('img', { name: /stacked account balances/i });

    expect(chart).toHaveAttribute('data-stale', 'true');

    rerender(<BalancesChart now={dateAtTaxDataAge(900)} />);

    expect(screen.getByRole('img', { name: /stacked account balances/i })).toHaveAttribute('data-stale', 'true');
  });
});
