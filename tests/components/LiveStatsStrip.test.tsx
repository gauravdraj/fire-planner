import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LiveStatsStrip } from '@/components/LiveStatsStrip';
import type { AccountBalances, YearBreakdown } from '@/core/projection';
import { toReal } from '@/lib/realDollars';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

const ZERO_BALANCES: AccountBalances = {
  cash: 0,
  taxableBrokerage: 0,
  traditional: 0,
  roth: 0,
};

function buildYearBreakdown(values: Partial<YearBreakdown> & Pick<YearBreakdown, 'year'>): YearBreakdown {
  return {
    year: values.year,
    spending: values.spending ?? 0,
    openingBalances: values.openingBalances ?? ZERO_BALANCES,
    withdrawals: values.withdrawals ?? ZERO_BALANCES,
    conversions: values.conversions ?? 0,
    brokerageHarvests: values.brokerageHarvests ?? 0,
    gainsOrLosses: ZERO_BALANCES,
    brokerageBasis: values.brokerageBasis ?? {
      opening: 0,
      sold: 0,
      realizedGainOrLoss: 0,
      closing: 0,
    },
    agi: values.agi ?? 0,
    acaMagi: values.acaMagi ?? values.agi ?? 0,
    irmaaMagi: values.irmaaMagi ?? values.agi ?? 0,
    federalTax: values.federalTax ?? 0,
    stateTax: values.stateTax ?? 0,
    ltcgTax: values.ltcgTax ?? 0,
    niit: values.niit ?? 0,
    seTax: values.seTax ?? 0,
    qbiDeduction: 0,
    taxableSocialSecurity: values.taxableSocialSecurity ?? 0,
    acaPremiumCredit: values.acaPremiumCredit ?? null,
    aptcReconciliation: null,
    irmaaPremium: values.irmaaPremium ?? null,
    totalTax: values.totalTax ?? 0,
    afterTaxCashFlow: values.afterTaxCashFlow ?? 0,
    warnings: [],
    closingBalances: values.closingBalances ?? ZERO_BALANCES,
  };
}

function statCells(): HTMLElement[] {
  return within(screen.getByLabelText('Live projection stats')).getAllByRole('listitem');
}

function statCell(id: string): HTMLElement {
  return screen.getByTestId(`live-stat-${id}`);
}

function cellAt(cells: readonly HTMLElement[], index: number): HTMLElement {
  const cell = cells[index];

  if (cell === undefined) {
    throw new Error(`Missing live stat cell ${index}`);
  }

  return cell;
}

describe('LiveStatsStrip', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the default scenario metrics in the required order', () => {
    render(<LiveStatsStrip />);

    const strip = screen.getByLabelText('Live projection stats');
    const cells = statCells();

    expect(strip).toHaveClass('sticky', 'top-0', 'z-10', 'bg-white/90', 'backdrop-blur');
    expect(cells).toHaveLength(6);
    expect(cellAt(cells, 0)).toHaveTextContent('Net worth at retirement');
    expect(cellAt(cells, 1)).toHaveTextContent('Plan-end balance');
    expect(cellAt(cells, 2)).toHaveTextContent('Years funded');
    expect(cellAt(cells, 3)).toHaveTextContent('Average MAGI');
    expect(cellAt(cells, 4)).toHaveTextContent('Max gross bucket draw');
    expect(cellAt(cells, 5)).toHaveTextContent('Total bridge tax');
    expect(within(cellAt(cells, 0)).getByText('$0')).toHaveClass('tabular-nums');
    expect(within(cellAt(cells, 1)).getByText('$0')).toHaveClass('tabular-nums');
    expect(within(cellAt(cells, 2)).getByText('1 year')).toHaveClass('tabular-nums');
    expect(within(cellAt(cells, 3)).getByText('$0')).toHaveClass('tabular-nums');
    expect(within(cellAt(cells, 4)).getByText('0%')).toHaveClass('tabular-nums');
    expect(within(cellAt(cells, 5)).getByText('$0')).toHaveClass('tabular-nums');
  });

  it('updates values after setFormValues and pulses changed stats without deltas', () => {
    vi.useFakeTimers();
    useUiStore.getState().setDisplayUnit('nominal');
    render(<LiveStatsStrip />);

    act(() => {
      useScenarioStore.getState().setFormValues({
        annualSpendingToday: 0,
        brokerageAndCashBalance: 100_000,
        currentYear: 2026,
        planEndAge: 63,
        primaryAge: 60,
        retirementYear: 2028,
        rothBalance: 30_000,
        taxableBrokerageBasis: 100_000,
        traditionalBalance: 20_000,
      });
    });

    expect(within(statCell('net-worth-at-retirement')).getByText('$150,000')).toBeInTheDocument();
    expect(within(statCell('plan-end-balance')).getByText('$150,000')).toBeInTheDocument();
    expect(within(statCell('years-funded')).getByText('2 years')).toBeInTheDocument();
    expect(statCell('net-worth-at-retirement')).toHaveClass('bg-yellow-100', 'transition-colors', 'duration-700');
    expect(screen.queryByText(/\+|\u2212|delta/i)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(statCell('net-worth-at-retirement')).not.toHaveClass('bg-yellow-100');

    act(() => {
      useUiStore.getState().setDisplayUnit('real');
    });

    const expectedRealRetirementBalance = DOLLAR_FORMATTER.format(toReal(150_000, 2028, 2026, 0.03));

    expect(within(statCell('net-worth-at-retirement')).getByText(expectedRealRetirementBalance)).toBeInTheDocument();
    expect(statCell('net-worth-at-retirement')).not.toHaveClass('bg-yellow-100');
  });

  it('applies severity classes to bridge risk metrics while keeping balance and tax metrics neutral', () => {
    const currentState = useScenarioStore.getState();
    useUiStore.getState().setDisplayUnit('nominal');
    useScenarioStore.setState({
      formValues: {
        ...currentState.formValues,
        annualSocialSecurityBenefit: 0,
        currentYear: 2026,
        primaryAge: 60,
        retirementYear: 2027,
        socialSecurityClaimAge: 70,
      },
      projectionResults: [
        buildYearBreakdown({
          acaMagi: 65_000,
          acaPremiumCredit: {
            applicablePercentage: 0.0996,
            fplPercent: 4.2,
            isEligible: false,
            premiumTaxCredit: 0,
            requiredContribution: 6_474,
          },
          agi: 65_000,
          closingBalances: {
            cash: 45_000,
            taxableBrokerage: 50_000,
            traditional: 0,
            roth: 0,
          },
          openingBalances: {
            cash: 50_000,
            taxableBrokerage: 50_000,
            traditional: 0,
            roth: 0,
          },
          totalTax: 4_000,
          withdrawals: {
            cash: 5_000,
            taxableBrokerage: 0,
            traditional: 0,
            roth: 0,
          },
          year: 2027,
        }),
      ],
      scenario: {
        ...currentState.scenario,
        filingStatus: 'single',
        healthcare: [{ year: 2027, kind: 'aca', annualBenchmarkPremium: 12_000, householdSize: 1 }],
        inflationRate: 0.03,
        startYear: 2026,
      },
    });

    render(<LiveStatsStrip />);

    expect(within(statCell('average-bridge-magi')).getByText('$65,000')).toHaveClass(
      'bg-rose-300',
      'text-rose-950',
      'font-bold',
    );
    expect(within(statCell('max-bridge-draw-percentage')).getByText('5%')).toHaveClass(
      'bg-rose-200',
      'text-rose-900',
    );

    for (const value of [
      within(statCell('plan-end-balance')).getByText('$95,000'),
      within(statCell('total-bridge-tax')).getByText('$4,000'),
    ]) {
      expect(value.className).not.toMatch(/\bbg-(rose|amber|emerald)-/);
      expect(value.className).not.toMatch(/\btext-(rose|amber|emerald)-/);
      expect(value).not.toHaveClass('font-bold', 'font-semibold');
    }
  });
});
