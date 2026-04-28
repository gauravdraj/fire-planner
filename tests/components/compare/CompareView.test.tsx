import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompareView } from '@/components/compare/CompareView';
import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { type SavedScenario, useScenariosStore } from '@/store/scenariosStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../../store/memoryStorage';

vi.mock('recharts', () => ({
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const HIGH_MAGI_BRIDGE_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'single',
  stateCode: 'FL',
  primaryAge: 52,
  partnerAge: 52,
  retirementYear: 2030,
  planEndAge: 78,
  annualSpendingToday: 125_000,
  annualMortgagePAndI: 0,
  mortgagePayoffYear: 0,
  annualW2Income: 150_000,
  annualConsultingIncome: 0,
  annualRentalIncome: 0,
  annualSocialSecurityBenefit: 24_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 0,
  brokerageAndCashBalance: 0,
  taxableBrokerageBasis: 0,
  hsaBalance: 40_000,
  traditionalBalance: 3_000_000,
  rothBalance: 250_000,
  autoDepleteBrokerageEnabled: false,
  autoDepleteBrokerageYears: 10,
  autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
  expectedReturnTraditional: 0.05,
  expectedReturnRoth: 0.05,
  expectedReturnBrokerage: 0.05,
  expectedReturnHsa: 0.05,
  brokerageDividendYield: 0,
  brokerageQdiPercentage: 0.95,
  healthcarePhase: 'aca',
};

const BALANCED_BRIDGE_VALUES: BasicFormValues = {
  ...HIGH_MAGI_BRIDGE_VALUES,
  annualSpendingToday: 82_000,
  brokerageAndCashBalance: 500_000,
  taxableBrokerageBasis: 350_000,
  traditionalBalance: 1_800_000,
  rothBalance: 350_000,
};

describe('CompareView headline metrics', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenariosStore.setState({ scenarios: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders expanded metrics, cliff risk coloring, and account mix shares', async () => {
    const first = saveNamedScenario('High MAGI bridge', HIGH_MAGI_BRIDGE_VALUES);
    const second = saveNamedScenario('Balanced bridge', BALANCED_BRIDGE_VALUES);

    render(<CompareView initialScenarioIds={[first.id, second.id]} />);

    const headlineSection = (await screen.findByRole('heading', { name: 'Headline metrics' })).closest('section');
    expect(headlineSection).not.toBeNull();
    const headlineTable = within(headlineSection as HTMLElement).getByRole('table');

    expect(within(headlineTable).getByText('Total bridge tax')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Average bridge MAGI')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Max withdrawal rate')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Years above 400% FPL cliff')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Years touching IRMAA')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Brokerage basis remaining at retirement')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Ending account mix')).toBeInTheDocument();

    const riskyCliffCells = within(headlineTable).getAllByLabelText(/ACA cliff years: [1-9]\d* years?/);
    expect(riskyCliffCells.length).toBeGreaterThan(0);
    expect(riskyCliffCells[0]).toHaveClass('bg-rose-200', 'text-rose-950', 'font-bold');

    for (const savedScenario of [first, second]) {
      const accountMix = screen.getByTestId(`ending-account-mix-${savedScenario.id}`);
      expect(within(accountMix).getByText(/Trad \d+%/)).toBeInTheDocument();
      expect(within(accountMix).getByText(/Roth \d+%/)).toBeInTheDocument();
      expect(within(accountMix).getByText(/Brokerage \d+%/)).toBeInTheDocument();
      expect(within(accountMix).getByText(/HSA \d+%/)).toBeInTheDocument();

      const shareTotal = Array.from(accountMix.querySelectorAll('[data-share-value]')).reduce(
        (total, element) => total + Number(element.getAttribute('data-share-value') ?? 0),
        0,
      );

      expect(shareTotal).toBe(100);
    }
  });
});

function saveNamedScenario(name: string, values: BasicFormValues): SavedScenario {
  const { plan, scenario } = mapBasicFormToProjectionInputs(values);

  return useScenariosStore.getState().save({ name, plan, scenario });
}
