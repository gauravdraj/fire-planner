import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PlanVerdict } from '@/components/PlanVerdict';
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

describe('PlanVerdict', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a solvent verdict through the plan end age with a real-dollar plan-end balance', () => {
    installProjectionFixture({
      endYear: 2027,
      planEndAge: 61,
      projectionResults: [
        buildYearBreakdown({ cash: 120_000, year: 2026 }),
        buildYearBreakdown({ cash: 110_000, year: 2027 }),
      ],
    });

    render(<PlanVerdict />);

    expect(screen.getByRole('heading', { name: 'Your plan is funded through age 61.' })).toBeInTheDocument();
    expect(screen.getByText(/Balance at plan end:/i)).toHaveTextContent("$100,000 in today's dollars.");
    expect(screen.queryByRole('link', { name: /adjust your plan/i })).not.toBeInTheDocument();
  });

  it('renders the current display unit for the plan-end balance', () => {
    installProjectionFixture({
      endYear: 2027,
      planEndAge: 61,
      projectionResults: [
        buildYearBreakdown({ cash: 120_000, year: 2026 }),
        buildYearBreakdown({ cash: 110_000, year: 2027 }),
      ],
    });
    useUiStore.getState().setDisplayUnit('nominal');

    render(<PlanVerdict />);

    expect(screen.getByText(/Balance at plan end:/i)).toHaveTextContent('$110,000 in nominal dollars.');
  });

  it('renders an insolvent verdict with shortfall years and a planner CTA', () => {
    installProjectionFixture({
      endYear: 2033,
      planEndAge: 67,
      projectionResults: [
        buildYearBreakdown({ cash: 80_000, year: 2026 }),
        buildYearBreakdown({ cash: 20_000, year: 2027 }),
        buildYearBreakdown({ cash: 0, year: 2028 }),
      ],
    });

    render(<PlanVerdict />);

    expect(
      screen.getByRole('heading', { name: 'Your plan is funded through 2028, leaving a 5-year shortfall.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /adjust your plan/i })).toHaveAttribute('href', '#adjust-your-plan');
  });
});

function installProjectionFixture({
  endYear,
  planEndAge,
  projectionResults,
}: {
  endYear: number;
  planEndAge: number;
  projectionResults: readonly YearBreakdown[];
}) {
  const current = useScenarioStore.getState();

  useScenarioStore.setState({
    formValues: {
      ...current.formValues,
      currentYear: 2026,
      primaryAge: 60,
      retirementYear: 2026,
      planEndAge,
    },
    plan: {
      ...current.plan,
      endYear,
    },
    projectionResults,
    scenario: {
      ...current.scenario,
      inflationRate: 0.1,
      startYear: 2026,
    },
  });
}

function buildYearBreakdown({ cash, year }: { cash: number; year: number }): YearBreakdown {
  return {
    year,
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
    closingBalances: {
      ...ZERO_BALANCES,
      cash,
    },
  };
}
