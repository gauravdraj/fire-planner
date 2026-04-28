import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { YearByYearTable } from '@/components/YearByYearTable';
import { balanceYearToZero } from '@/core/balanceYearToZero';
import { CONSTANTS_2026 } from '@/core/constants/2026';
import type { AccountBalances, YearBreakdown } from '@/core/projection';
import { yearByYearColumnBands, yearByYearColumns } from '@/lib/yearByYearColumns';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

vi.mock('@/core/balanceYearToZero', () => ({
  balanceYearToZero: vi.fn(),
}));

const mockBalanceYearToZero = vi.mocked(balanceYearToZero);

const ZERO_BALANCES: AccountBalances = {
  cash: 0,
  hsa: 0,
  taxableBrokerage: 0,
  traditional: 0,
  roth: 0,
};

const TABLE_FIXTURE = [
  buildYearBreakdown({
    afterTaxCashFlow: 12_000,
    agi: 55_000,
    acaMagi: 55_000,
    closingBalances: {
      cash: 20_000,
      hsa: 0,
      taxableBrokerage: 80_000,
      traditional: 60_000,
      roth: 40_000,
    },
    federalTax: 4_000,
    totalTax: 5_000,
    brokerageBasis: {
      opening: 50_000,
      sold: 0,
      realizedGainOrLoss: 0,
      closing: 50_000,
    },
    year: 2026,
  }),
  buildYearBreakdown({
    afterTaxCashFlow: 80_000,
    agi: 65_000,
    acaMagi: 62_000,
    acaPremiumCredit: {
      applicablePercentage: 0.0996,
      fplPercent: 4.2,
      isEligible: false,
      premiumTaxCredit: 2_500,
      requiredContribution: 6_175.2,
    },
    brokerageBasis: {
      opening: 50_000,
      sold: 5_000,
      realizedGainOrLoss: 1_500,
      closing: 45_000,
    },
    closingBalances: {
      cash: 5_000,
      hsa: 15_000,
      taxableBrokerage: 55_000,
      traditional: 90_000,
      roth: 40_000,
    },
    conversions: 12_000,
    federalTax: 5_000,
    ltcgTax: 100,
    spending: 70_000,
    stateTax: 900,
    taxableSocialSecurity: 8_000,
    totalTax: 6_000,
    withdrawals: {
      cash: 0,
      hsa: 0,
      taxableBrokerage: 4_000,
      traditional: 6_000,
      roth: 0,
    },
    year: 2027,
  }),
  buildYearBreakdown({
    afterTaxCashFlow: -2_000,
    agi: 80_000,
    acaMagi: 80_000,
    closingBalances: {
      cash: 0,
      hsa: 20_000,
      taxableBrokerage: 40_000,
      traditional: 80_000,
      roth: 45_000,
    },
    federalTax: 8_000,
    irmaaPremium: {
      annualIrmaaSurcharge: 2_000,
      annualTotal: 4_000,
      magiSourceYear: 2026,
      magiUsed: 55_000,
      partBMonthlyAdjustment: 100,
      partDMonthlyAdjustment: 66.67,
      standardPartBPremium: 0,
      tier: 1,
    },
    totalTax: 10_000,
    withdrawals: {
      cash: 0,
      hsa: 0,
      taxableBrokerage: 8_000,
      traditional: 8_000,
      roth: 0,
    },
    year: 2028,
  }),
] as const satisfies readonly YearBreakdown[];

function dateAtTaxDataAge(ageDays: number): string {
  const date = new Date(`${CONSTANTS_2026.retrievedAt}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + ageDays);

  return date.toISOString().slice(0, 10);
}

function buildYearBreakdown(values: Partial<YearBreakdown> & Pick<YearBreakdown, 'year'>): YearBreakdown {
  return {
    year: values.year,
    spending: values.spending ?? 0,
    openingBalances: ZERO_BALANCES,
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

function installFixtureState() {
  const current = useScenarioStore.getState();

  useScenarioStore.setState({
    formValues: {
      ...current.formValues,
      currentYear: 2026,
      filingStatus: 'single',
      primaryAge: 60,
      retirementYear: 2027,
    },
    projectionResults: TABLE_FIXTURE,
    scenario: {
      ...current.scenario,
      filingStatus: 'single',
      healthcare: [
        { year: 2027, kind: 'aca', annualBenchmarkPremium: 12_000, householdSize: 2 },
        { year: 2028, kind: 'medicare' },
      ],
      inflationRate: 0.03,
      startYear: 2026,
      w2Income: [
        { year: 2026, amount: 50_000 },
        { year: 2027, amount: 45_000 },
        { year: 2028, amount: 0 },
      ],
    },
  });
}

function rowForYear(year: number): HTMLElement {
  return screen.getByRole('rowheader', { name: String(year) }).closest('tr') as HTMLElement;
}

function cellFor(year: number, columnId: string): HTMLElement {
  return screen.getByTestId(`year-table-cell-${year}-${columnId}`);
}

function headerFor(label: string): HTMLElement {
  return screen.getByText(label).closest('th') as HTMLElement;
}

describe('YearByYearTable', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
    installFixtureState();
    mockBalanceYearToZero.mockClear();
    mockBalanceYearToZero.mockImplementation((year) => ({
      year,
      brokerageWithdrawal: year === 2028 ? 2_500 : 1_000,
      resultingCashflow: 0,
      iterations: 1,
      converged: true,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders grouped sticky headers inside a horizontal scroller', () => {
    const { container } = render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    expect(screen.getByRole('heading', { name: 'Year-by-year projection' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download JSON' })).toBeInTheDocument();
    expect(screen.getByText(/Scroll sideways on smaller screens/i)).toBeInTheDocument();
    expect(screen.getByTestId('year-table-scroll')).toHaveClass(
      'max-w-full',
      'overflow-x-auto',
      'overscroll-x-contain',
      'dark:bg-slate-950',
    );
    expect(container.querySelectorAll('thead tr')).toHaveLength(2);

    const bandHeaders = Array.from(container.querySelectorAll('thead tr:first-child th'));
    expect(bandHeaders.map((header) => header.textContent)).toEqual([...yearByYearColumnBands]);
    expect(bandHeaders.map((header) => header.getAttribute('colspan'))).toEqual(
      yearByYearColumnBands.map(
        (band) => `${yearByYearColumns.filter((column) => column.band === band).length}`,
      ),
    );

    expect(screen.getByRole('columnheader', { name: 'Year' })).toHaveClass('sticky', 'left-0');
    expect(screen.getByRole('columnheader', { name: 'Age' })).toHaveClass('sticky', 'left-20');
    expect(screen.getByRole('columnheader', { name: 'Phase' })).toHaveClass('sticky', 'left-[9rem]');
    expect(screen.getByRole('columnheader', { name: 'Age' })).toBeInTheDocument();
    expect(headerFor('Trad')).toHaveClass('border-l');
    expect(headerFor('Roth')).toBeInTheDocument();
    expect(headerFor('HSA')).toBeInTheDocument();
    expect(headerFor('Taxable')).toBeInTheDocument();
    expect(headerFor('Cash')).toBeInTheDocument();
    expect(headerFor('Total')).toBeInTheDocument();
    expect(headerFor('Basis')).toBeInTheDocument();
    expect(headerFor('IRA dist.')).toBeInTheDocument();
    expect(headerFor('Roth conv.')).toBeInTheDocument();
    expect(headerFor('Brokerage wd.')).toBeInTheDocument();
    expect(headerFor('Realized gain/loss')).toBeInTheDocument();
    expect(headerFor('AGI')).toBeInTheDocument();
    expect(headerFor('Federal')).toBeInTheDocument();
    expect(headerFor('State')).toBeInTheDocument();
    expect(headerFor('LTCG')).toBeInTheDocument();
    expect(headerFor('NIIT')).toBeInTheDocument();
    expect(headerFor('SE')).toBeInTheDocument();
    expect(headerFor('ACA MAGI')).toBeInTheDocument();
    expect(headerFor('FPL %')).toBeInTheDocument();
    expect(headerFor('Withdrawal rate')).toBeInTheDocument();
    expect(headerFor('ACA PTC')).toBeInTheDocument();
    expect(headerFor('IRMAA')).toBeInTheDocument();
    expect(headerFor('After-tax cash flow')).toBeInTheDocument();
  });

  it('attaches InfoTooltip content to every column header', () => {
    const { container } = render(<YearByYearTable now={dateAtTaxDataAge(0)} />);
    const secondHeaderRow = container.querySelector('thead tr:nth-child(2)');

    expect(secondHeaderRow).not.toBeNull();
    expect(within(secondHeaderRow as HTMLElement).getAllByRole('button', { name: /About / })).toHaveLength(
      yearByYearColumns.length,
    );

    fireEvent.focus(screen.getByRole('button', { name: 'About ACA MAGI' }));
    expect(
      screen
        .getByText('Modified adjusted gross income used for ACA premium tax credit eligibility and FPL percentage.')
        .closest('[role="tooltip"]'),
    ).toHaveTextContent(
      'Modified adjusted gross income used for ACA premium tax credit eligibility and FPL percentage.',
    );
  });

  it('renders representative engine and display-derived values in nominal dollars', () => {
    useUiStore.getState().setDisplayUnit('nominal');

    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    expect(cellFor(2027, 'age')).toHaveTextContent('61');
    expect(cellFor(2027, 'phase')).toHaveTextContent('Bridge');
    expect(cellFor(2027, 'traditionalBalance')).toHaveTextContent('$90,000');
    expect(cellFor(2027, 'rothBalance')).toHaveTextContent('$40,000');
    expect(cellFor(2027, 'hsaBalance')).toHaveTextContent('$15,000');
    expect(cellFor(2027, 'taxableBrokerageBalance')).toHaveTextContent('$55,000');
    expect(cellFor(2027, 'cashBalance')).toHaveTextContent('$5,000');
    expect(cellFor(2027, 'endingBalance')).toHaveTextContent('$205,000');
    expect(cellFor(2027, 'brokerageBasisRemaining')).toHaveTextContent('$45,000');
    expect(cellFor(2027, 'spending')).toHaveTextContent('$70,000');
    expect(cellFor(2027, 'wages')).toHaveTextContent('$45,000');
    expect(cellFor(2027, 'taxableSocialSecurity')).toHaveTextContent('$8,000');
    expect(cellFor(2027, 'traditionalWithdrawals')).toHaveTextContent('$6,000');
    expect(cellFor(2027, 'rothConversions')).toHaveTextContent('$12,000');
    expect(cellFor(2027, 'brokerageWithdrawals')).toHaveTextContent('$4,000');
    expect(cellFor(2027, 'realizedLtcg')).toHaveTextContent('$1,500');
    expect(cellFor(2027, 'agi')).toHaveTextContent('$65,000');
    expect(cellFor(2027, 'federalTax')).toHaveTextContent('$5,000');
    expect(cellFor(2027, 'stateTax')).toHaveTextContent('$900');
    expect(cellFor(2027, 'ltcgTax')).toHaveTextContent('$100');
    expect(cellFor(2027, 'niit')).toHaveTextContent('$0');
    expect(cellFor(2027, 'seTax')).toHaveTextContent('$0');
    expect(cellFor(2027, 'totalTax')).toHaveTextContent('$6,000');
    expect(cellFor(2027, 'acaMagi')).toHaveTextContent('$62,000');
    expect(cellFor(2027, 'fplPercentage')).toHaveTextContent('420%');
    expect(cellFor(2027, 'withdrawalRate')).toHaveTextContent('5%');
    expect(cellFor(2027, 'acaPremiumCredit')).toHaveTextContent('$2,500');
    expect(cellFor(2027, 'afterTaxCashFlow')).toHaveTextContent('$80,000');
    expect(cellFor(2028, 'irmaaPremium')).toHaveTextContent('$2,000');

    expect(cellFor(2026, 'acaPremiumCredit')).toHaveTextContent('—');
    expect(cellFor(2027, 'age')).toHaveClass('text-right', 'tabular-nums');
    expect(cellFor(2027, 'phase')).toHaveClass('text-left');
  });

  it('downloads year-by-year rows as a CSV Blob', () => {
    const createObjectURL = vi.fn(() => 'blob:fire-planner-csv');
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });

    try {
      render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

      fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fire-planner-csv');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: originalRevokeObjectURL,
      });
      click.mockRestore();
    }
  });

  it('downloads the active scenario as a JSON Blob', () => {
    const createObjectURL = vi.fn((blob: Blob) => {
      expect(blob).toBeInstanceOf(Blob);
      return 'blob:fire-planner-json';
    });
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });

    try {
      render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

      fireEvent.click(screen.getByRole('button', { name: 'Download JSON' }));

      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(createObjectURL.mock.calls[0]?.[0].type).toBe('application/json;charset=utf-8');
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fire-planner-json');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: originalRevokeObjectURL,
      });
      click.mockRestore();
    }
  });

  it('renders and colors FPL percentage for non-ACA rows using the filing-status fallback', () => {
    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    const nonAcaFplValue = within(cellFor(2028, 'fplPercentage')).getByText(/\d+(?:\.\d)?%/);

    expect(nonAcaFplValue).toHaveTextContent('486.6%');
    expect(nonAcaFplValue).toHaveClass('bg-rose-200', 'text-rose-950', 'font-bold');
    expect(cellFor(2028, 'fplPercentage')).toHaveTextContent('FPL band: above the ACA subsidy cliff risk area.');
  });

  it('converts displayed monetary values between real and nominal dollars', () => {
    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    expect(cellFor(2027, 'traditionalBalance')).toHaveTextContent('$87,379');
    expect(cellFor(2027, 'agi')).toHaveTextContent('$63,107');
    expect(cellFor(2027, 'endingBalance')).toHaveTextContent('$199,029');

    cleanup();
    useUiStore.getState().setDisplayUnit('nominal');

    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    expect(cellFor(2027, 'traditionalBalance')).toHaveTextContent('$90,000');
    expect(cellFor(2027, 'agi')).toHaveTextContent('$65,000');
    expect(cellFor(2027, 'endingBalance')).toHaveTextContent('$205,000');
  });

  it('colors threshold KPI cells, highlights the retirement row, and marks near federal brackets', () => {
    useUiStore.getState().setDisplayUnit('nominal');
    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    expect(rowForYear(2027)).toHaveClass('border-l-4', 'border-indigo-500', 'bg-indigo-50/40');
    expect(cellFor(2027, 'year')).toHaveClass('border-l-4', 'border-indigo-500');

    expect(within(cellFor(2027, 'fplPercentage')).getByText('420%')).toHaveClass(
      'bg-rose-200',
      'text-rose-950',
      'font-bold',
    );
    expect(cellFor(2027, 'fplPercentage')).toHaveTextContent('FPL band: above the ACA subsidy cliff risk area.');
    expect(within(cellFor(2027, 'withdrawalRate')).getByText('5%')).toHaveClass('bg-rose-100', 'text-rose-800');
    expect(cellFor(2027, 'withdrawalRate')).toHaveTextContent(
      'Withdrawal-rate band: between the 5% danger threshold and 10% catastrophic threshold.',
    );
    expect(within(cellFor(2028, 'afterTaxCashFlow')).getByText('-$2,000')).toHaveClass(
      'text-rose-700',
      'font-semibold',
    );

    expect(cellFor(2027, 'federalTax')).toHaveClass('bg-amber-50', 'text-amber-900');
    expect(cellFor(2027, 'federalTax')).toHaveTextContent('near');
    expect(cellFor(2027, 'federalTax')).toHaveTextContent(
      'Federal taxable income is $3,012 below the next ordinary bracket edge.',
    );
  });

  it('renders passive balance hints after the debounce delay', () => {
    vi.useFakeTimers();
    useUiStore.getState().setDisplayUnit('nominal');
    useScenarioStore.setState({
      projectionResults: [
        ...TABLE_FIXTURE,
        buildYearBreakdown({
          afterTaxCashFlow: 50,
          year: 2029,
        }),
      ],
    });

    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    expect(mockBalanceYearToZero).not.toHaveBeenCalled();
    expect(cellFor(2028, 'afterTaxCashFlow')).not.toHaveTextContent('to balance');

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(mockBalanceYearToZero).toHaveBeenCalledWith(2028, expect.any(Object), expect.any(Object), {
      tolerance: 100,
    });
    expect(mockBalanceYearToZero).toHaveBeenCalledWith(2029, expect.any(Object), expect.any(Object), {
      tolerance: 100,
    });
    expect(mockBalanceYearToZero).not.toHaveBeenCalledWith(2027, expect.any(Object), expect.any(Object), {
      tolerance: 100,
    });
    expect(within(cellFor(2028, 'afterTaxCashFlow')).getByText(/→ \+\$\d[\d,]* to balance/)).toBeVisible();
    expect(within(cellFor(2028, 'afterTaxCashFlow')).getByText('→ +$2,500 to balance')).toHaveClass(
      'text-amber-700',
      'dark:text-amber-300',
    );
    expect(within(cellFor(2029, 'afterTaxCashFlow')).getByText('→ balanced')).toBeVisible();
    expect(within(cellFor(2029, 'afterTaxCashFlow')).getByText('→ balanced')).toHaveClass(
      'text-emerald-700',
      'dark:text-emerald-300',
    );
  });

  it('recomputes passive balance hints when projection inputs change', () => {
    vi.useFakeTimers();
    useUiStore.getState().setDisplayUnit('nominal');
    mockBalanceYearToZero.mockImplementation((year, _scenario, plan) => {
      const spendingForYear = plan.annualSpending.find((entry) => entry.year === year)?.amount ?? 0;

      return {
        year,
        brokerageWithdrawal: spendingForYear === 123_456 ? 7_500 : 2_500,
        resultingCashflow: 0,
        iterations: 1,
        converged: true,
      };
    });

    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(within(cellFor(2028, 'afterTaxCashFlow')).getByText('→ +$2,500 to balance')).toBeVisible();

    const currentPlan = useScenarioStore.getState().plan;
    const updatedPlan = {
      ...currentPlan,
      annualSpending: [
        ...currentPlan.annualSpending.filter((entry) => entry.year !== 2028),
        { year: 2028, amount: 123_456 },
      ],
    };

    act(() => {
      useScenarioStore.setState({
        plan: updatedPlan,
        projectionResults: TABLE_FIXTURE.map((breakdown) =>
          breakdown.year === 2028 ? { ...breakdown, afterTaxCashFlow: -6_000 } : breakdown,
        ),
      });
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(within(cellFor(2028, 'afterTaxCashFlow')).getByText('→ +$7,500 to balance')).toBeVisible();
    expect(cellFor(2028, 'afterTaxCashFlow')).not.toHaveTextContent('→ +$2,500 to balance');
    expect(mockBalanceYearToZero.mock.calls.at(-1)?.[2]).toMatchObject({
      annualSpending: expect.arrayContaining([{ year: 2028, amount: 123_456 }]),
    });
  });

  it('caps balance hints to the first 15 chronological retirement rows', () => {
    vi.useFakeTimers();
    useUiStore.getState().setDisplayUnit('nominal');
    useScenarioStore.setState({
      formValues: {
        ...useScenarioStore.getState().formValues,
        retirementYear: 2027,
      },
      projectionResults: [
        buildYearBreakdown({ afterTaxCashFlow: -1_000, year: 2026 }),
        ...Array.from({ length: 16 }, (_unused, index) =>
          buildYearBreakdown({ afterTaxCashFlow: -1_000, year: 2027 + index }),
        ),
      ],
    });

    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(mockBalanceYearToZero.mock.calls.map((call) => call[0])).toEqual(
      Array.from({ length: 15 }, (_unused, index) => 2027 + index),
    );
    expect(cellFor(2041, 'afterTaxCashFlow')).toHaveTextContent('→ +$1,000 to balance');
    expect(cellFor(2042, 'afterTaxCashFlow')).not.toHaveTextContent('to balance');
    expect(cellFor(2026, 'afterTaxCashFlow')).not.toHaveTextContent('to balance');
  });

  it('marks all output rows and cells stale for soft and hard tax-data staleness', () => {
    const { rerender } = render(<YearByYearTable now={dateAtTaxDataAge(540)} />);

    for (const row of screen.getAllByRole('row').slice(2)) {
      expect(row).toHaveAttribute('data-stale', 'true');
      expect(within(row).getByRole('rowheader')).toHaveAttribute('data-stale', 'true');
      for (const cell of within(row).getAllByRole('cell')) {
        expect(cell).toHaveAttribute('data-stale', 'true');
      }
    }

    rerender(<YearByYearTable now={dateAtTaxDataAge(900)} />);

    expect(rowForYear(2027)).toHaveAttribute('data-stale', 'true');
  });

  it('pulses changed cells from raw metric values without flashing on display-unit changes', () => {
    vi.useFakeTimers();
    useUiStore.getState().setDisplayUnit('nominal');
    render(<YearByYearTable now={dateAtTaxDataAge(0)} />);

    act(() => {
      useScenarioStore.setState({
        projectionResults: TABLE_FIXTURE.map((breakdown) =>
          breakdown.year === 2027 ? { ...breakdown, agi: 70_000, acaMagi: 67_000 } : breakdown,
        ),
      });
    });

    expect(cellFor(2027, 'agi')).toHaveTextContent('$70,000');
    expect(cellFor(2027, 'agi')).toHaveClass('bg-yellow-100', 'transition-colors', 'duration-700');

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(cellFor(2027, 'agi')).not.toHaveClass('bg-yellow-100');

    act(() => {
      useUiStore.getState().setDisplayUnit('real');
    });

    expect(cellFor(2027, 'agi')).toHaveTextContent('$67,961');
    expect(cellFor(2027, 'agi')).not.toHaveClass('bg-yellow-100');
  });
});
