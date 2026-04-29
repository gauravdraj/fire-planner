import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BasicForm } from '@/components/BasicForm';
import { basicControlHelp } from '@/lib/basicControlHelp';
import { useScenarioStore } from '@/store/scenarioStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

function changeField(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function advanceLiveDebounce() {
  act(() => {
    vi.advanceTimersByTime(151);
  });
}

function expectTooltip(trigger: HTMLElement, text: string) {
  const tooltipId = trigger.getAttribute('aria-describedby');
  const tooltip = tooltipId === null ? null : document.getElementById(tooltipId);

  if (tooltip === null) {
    throw new Error(`Expected ${trigger.getAttribute('aria-label') ?? 'tooltip trigger'} to describe a tooltip.`);
  }

  expect(tooltip).toHaveAttribute('role', 'tooltip');
  expect(tooltip).toHaveTextContent(text);
}

const CONTRIBUTION_HELP_EXPECTATIONS = [
  ['About Traditional annual contribution', basicControlHelp.annualContributionTraditional.description],
  ['About Roth annual contribution', basicControlHelp.annualContributionRoth.description],
  ['About HSA annual contribution', basicControlHelp.annualContributionHsa.description],
  ['About Brokerage annual contribution', basicControlHelp.annualContributionBrokerage.description],
] as const;

describe('BasicForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installMemoryLocalStorage();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the supported Gate 3 basic fields with defaults and no submit button', () => {
    render(<BasicForm />);

    expect(screen.getByRole('form', { name: /basic scenario form/i })).toHaveClass('sm:grid-cols-2');
    expect(screen.getByLabelText('Filing status')).toHaveValue('mfj');
    expect(screen.getByLabelText('State')).toHaveValue('CA');
    expect(screen.getByLabelText('Primary age')).toBeInTheDocument();
    expect(screen.getByLabelText('Partner age')).toBeInTheDocument();
    expect(screen.getByLabelText('Current year')).toBeInTheDocument();
    expect(screen.getByLabelText('Retirement target year')).toBeInTheDocument();
    expect(screen.getByLabelText('Plan-end age')).toBeInTheDocument();
    expect(screen.getByLabelText('Annual spending')).toBeInTheDocument();
    expect(screen.getByLabelText('Inflation rate')).toHaveValue('0.025');
    expect(screen.getByLabelText('Annual mortgage P&I')).toBeInTheDocument();
    expect(screen.getByLabelText('Mortgage payoff year')).toBeInTheDocument();
    expect(screen.getByLabelText('Traditional balance')).toBeInTheDocument();
    expect(screen.getByLabelText('Roth balance')).toBeInTheDocument();
    expect(screen.getByLabelText('Brokerage plus cash balance')).toBeInTheDocument();
    expect(screen.getByLabelText('Weighted-average taxable basis')).toBeInTheDocument();
    expect(screen.getByLabelText('HSA balance')).toBeInTheDocument();
    expect(screen.getByLabelText('Auto-deplete brokerage')).not.toBeChecked();
    expect(screen.getByLabelText('Brokerage depletion years')).toHaveValue('10');
    expect(screen.getByLabelText('Brokerage annual scale-up factor')).toHaveValue('0.02');
    expect(screen.getByLabelText('W-2 income')).toBeInTheDocument();
    expect(screen.getByText('Pre-retirement contributions')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Traditional and HSA contributions are pre-tax; Roth and brokerage contributions are post-tax. Contributions stop at retirement.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Traditional annual contribution')).toHaveValue('0');
    expect(screen.getByLabelText('Roth annual contribution')).toHaveValue('0');
    expect(screen.getByLabelText('HSA annual contribution')).toHaveValue('0');
    expect(screen.getByLabelText('Brokerage annual contribution')).toHaveValue('0');
    expect(screen.getByLabelText('Net consulting income')).toBeInTheDocument();
    expect(screen.getByLabelText('Net rental income')).toBeInTheDocument();
    expect(screen.getByLabelText('Social Security annual benefit')).toBeInTheDocument();
    expect(screen.getByLabelText('Social Security claim age')).toBeInTheDocument();
    expect(screen.getByLabelText('Pension/annuity annual amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Healthcare phase')).toBeInTheDocument();
    expect(screen.getByLabelText('Traditional expected return')).toHaveValue('0.05');
    expect(screen.getByLabelText('Roth expected return')).toHaveValue('0.05');
    expect(screen.getByLabelText('Brokerage expected return')).toHaveValue('0.05');
    expect(screen.getByLabelText('HSA expected return')).toHaveValue('0.05');
    expect(screen.getByLabelText('Brokerage dividend yield')).toHaveValue('0.015');
    expect(screen.getByLabelText('Qualified dividend percentage')).toHaveValue('0.95');
    expect(
      screen.getByText(
        'Expected account returns plus taxable brokerage dividend yield and qualified-dividend share assumptions.',
        { selector: 'p' },
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/price return plus after-tax reinvested dividends/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cash expected return')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run projection/i })).not.toBeInTheDocument();
  });

  it('groups fields into the ordered basic form sections', () => {
    const { container } = render(<BasicForm />);
    const fieldsets = Array.from(container.querySelectorAll('fieldset')) as HTMLElement[];

    expect(fieldsets).toHaveLength(8);
    expect(
      fieldsets.map((fieldset) =>
        fieldset.querySelector('legend span')?.childNodes[0]?.textContent?.trim(),
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
    for (const fieldset of fieldsets) {
      expect(fieldset).toHaveClass(
        'rounded-xl',
        'border',
        'border-slate-200',
        'bg-white/90',
        'p-4',
        'dark:border-slate-800',
        'dark:bg-slate-900/60',
      );
      expect(fieldset).toHaveAttribute('aria-describedby');
      expect(fieldset.querySelector('legend')).toHaveClass(
        'px-2',
        'text-sm',
        'font-semibold',
        'text-slate-800',
        'dark:text-slate-100',
      );
    }

    const household = screen.getByRole('group', { name: /household/i });
    expect(within(household).getByLabelText('Filing status')).toBeInTheDocument();
    expect(within(household).getByLabelText('State')).toBeInTheDocument();
    expect(within(household).getByLabelText('Primary age')).toBeInTheDocument();
    expect(within(household).getByLabelText('Partner age')).toBeInTheDocument();

    const timeline = screen.getByRole('group', { name: /timeline/i });
    expect(within(timeline).getByLabelText('Current year')).toBeInTheDocument();
    expect(within(timeline).getByLabelText('Retirement target year')).toBeInTheDocument();
    expect(within(timeline).getByLabelText('Plan-end age')).toBeInTheDocument();
    expect(within(timeline).getByLabelText('Social Security claim age')).toBeInTheDocument();

    const spending = screen.getByRole('group', { name: /spending & debt/i });
    expect(within(spending).getByLabelText('Annual spending')).toBeInTheDocument();
    expect(within(spending).getByLabelText('Inflation rate')).toBeInTheDocument();
    expect(within(spending).getByLabelText('Annual mortgage P&I')).toBeInTheDocument();
    expect(within(spending).getByLabelText('Mortgage payoff year')).toBeInTheDocument();

    const withdrawalStrategy = screen.getByRole('group', { name: /withdrawal strategy/i });
    expect(within(withdrawalStrategy).queryByLabelText('Inflation rate')).not.toBeInTheDocument();
    expect(within(withdrawalStrategy).getByLabelText('Auto-deplete brokerage')).toBeInTheDocument();
    expect(within(withdrawalStrategy).getByLabelText('Brokerage depletion years')).toBeInTheDocument();
    expect(within(withdrawalStrategy).getByLabelText('Brokerage annual scale-up factor')).toBeInTheDocument();

    const accounts = screen.getByRole('group', { name: /accounts/i });
    expect(within(accounts).getByLabelText('Traditional balance')).toBeInTheDocument();
    expect(within(accounts).getByLabelText('Roth balance')).toBeInTheDocument();
    expect(within(accounts).getByLabelText('Brokerage plus cash balance')).toBeInTheDocument();
    expect(within(accounts).getByLabelText('Weighted-average taxable basis')).toBeInTheDocument();
    expect(within(accounts).getByLabelText('HSA balance')).toBeInTheDocument();

    const income = screen.getByRole('group', { name: /income/i });
    expect(within(income).getByLabelText('W-2 income')).toBeInTheDocument();
    expect(within(income).getByText('Pre-retirement contributions')).toBeInTheDocument();
    expect(within(income).getByLabelText('Traditional annual contribution')).toBeInTheDocument();
    expect(within(income).getByLabelText('Roth annual contribution')).toBeInTheDocument();
    expect(within(income).getByLabelText('HSA annual contribution')).toBeInTheDocument();
    expect(within(income).getByLabelText('Brokerage annual contribution')).toBeInTheDocument();
    expect(within(income).getByLabelText('Net consulting income')).toBeInTheDocument();
    expect(within(income).getByLabelText('Net rental income')).toBeInTheDocument();
    expect(within(income).getByLabelText('Social Security annual benefit')).toBeInTheDocument();
    expect(within(income).getByLabelText('Pension/annuity annual amount')).toBeInTheDocument();

    expect(
      within(screen.getByRole('group', { name: /healthcare/i })).getByLabelText('Healthcare phase'),
    ).toBeInTheDocument();

    const growthDividends = screen.getByRole('group', { name: /growth & dividends/i });
    expect(within(growthDividends).getByLabelText('Traditional expected return')).toBeInTheDocument();
    expect(within(growthDividends).getByLabelText('Roth expected return')).toBeInTheDocument();
    expect(within(growthDividends).getByLabelText('Brokerage expected return')).toBeInTheDocument();
    expect(within(growthDividends).getByLabelText('HSA expected return')).toBeInTheDocument();
    expect(within(growthDividends).getByLabelText('Brokerage dividend yield')).toBeInTheDocument();
    expect(within(growthDividends).getByLabelText('Qualified dividend percentage')).toBeInTheDocument();
    expect(within(growthDividends).queryByLabelText('Cash expected return')).not.toBeInTheDocument();
  });

  it('shows partner age only for married filing jointly', () => {
    render(<BasicForm />);

    expect(within(screen.getByRole('group', { name: /household/i })).getByLabelText('Partner age')).toBeInTheDocument();

    changeField('Filing status', 'single');

    expect(screen.queryByLabelText('Partner age')).not.toBeInTheDocument();

    changeField('Filing status', 'mfj');

    expect(within(screen.getByRole('group', { name: /household/i })).getByLabelText('Partner age')).toBeInTheDocument();
  });

  it('adds accessible section tooltips to every fieldset legend', () => {
    render(<BasicForm />);

    expect(
      screen.getAllByRole('button', {
        name: /^About (Household|Timeline|Spending & debt|Withdrawal strategy|Accounts|Income|Healthcare|Growth & dividends)$/,
      }),
    ).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'About Household' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Spending & debt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Withdrawal strategy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Income' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Healthcare' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Growth & dividends' })).toBeInTheDocument();

    fireEvent.focus(screen.getByRole('button', { name: 'About Accounts' }));

    expectTooltip(
      screen.getByRole('button', { name: 'About Accounts' }),
      'Starting supported account balances, including HSA, and taxable basis used by the withdrawal display layer.',
    );
    expect(
      screen.getAllByText(
        'Starting supported account balances, including HSA, and taxable basis used by the withdrawal display layer.',
      ),
    ).toHaveLength(2);
  });

  it('adds metadata-backed tooltips to input, select, and checkbox labels', () => {
    render(<BasicForm />);

    expect(screen.getByLabelText('Annual spending')).toBeInTheDocument();
    expect(screen.getByLabelText('Filing status')).toHaveValue('mfj');
    expect(screen.getByLabelText('Auto-deplete brokerage')).not.toBeChecked();

    expectTooltip(
      screen.getByRole('button', { name: 'About Annual spending' }),
      basicControlHelp.annualSpendingToday.description,
    );
    expectTooltip(
      screen.getByRole('button', { name: 'About Filing status' }),
      basicControlHelp.filingStatus.description,
    );
    expectTooltip(
      screen.getByRole('button', { name: 'About Auto-deplete brokerage' }),
      basicControlHelp.autoDepleteBrokerageEnabled.description,
    );
    for (const [name, description] of CONTRIBUTION_HELP_EXPECTATIONS) {
      expectTooltip(screen.getByRole('button', { name }), description);
    }
  });

  it('renders derived chips and updates them after valid debounced edits', () => {
    render(<BasicForm />);

    expect(screen.getByText('→ Age 58 in 3 yrs')).toHaveClass(
      'text-xs',
      'uppercase',
      'tracking-wide',
      'text-slate-500',
    );
    expect(screen.getByText('→ Year 1 $220,000 -> 2066 $590,714 nominal')).toBeInTheDocument();
    expect(screen.getByText('→ Stops in 2029')).toBeInTheDocument();
    expect(screen.getByText('→ No mortgage modeled')).toBeInTheDocument();
    expect(screen.getByText('→ Claims in 2041 at age 70')).toBeInTheDocument();
    expect(screen.getByText('→ Subsidy band unavailable')).toBeInTheDocument();

    changeField('Retirement target year', '2030');
    changeField('Annual spending', '90000');
    changeField('Inflation rate', '0.02');
    changeField('Annual mortgage P&I', '24000');
    changeField('Mortgage payoff year', '2030');
    changeField('Social Security claim age', '68');
    changeField('Healthcare phase', 'aca');
    advanceLiveDebounce();

    expect(screen.getByText('→ Age 59 in 4 yrs')).toBeInTheDocument();
    expect(screen.getByText('→ Year 1 $90,000 -> 2066 $198,724 nominal')).toBeInTheDocument();
    expect(screen.getByText('→ 5 yrs of payments through 2030')).toBeInTheDocument();
    expect(screen.getByText('→ Stops in 2030')).toBeInTheDocument();
    expect(screen.getByText('→ Claims in 2039 at age 68')).toBeInTheDocument();
    expect(screen.getByText('→ Subsidy band: above 500% FPL')).toBeInTheDocument();

    changeField('Annual spending', '');
    advanceLiveDebounce();

    expect(screen.getByText('Annual spending is required.')).toBeInTheDocument();
    expect(screen.getByText('→ Year 1 $90,000 -> 2066 $198,724 nominal')).toBeInTheDocument();
    expect(screen.getByText('→ 5 yrs of payments through 2030')).toBeInTheDocument();
  });

  it('highlights blank required fields and out-of-range values', () => {
    render(<BasicForm />);

    changeField('Annual spending', '');
    changeField('Primary age', '17');
    changeField('Partner age', '111');
    changeField('Retirement target year', '2025');
    changeField('Social Security claim age', '71');

    expect(screen.getByLabelText('Annual spending')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Annual spending is required.')).toBeInTheDocument();
    expect(screen.getAllByText('Enter an age from 18 to 110.')).toHaveLength(2);
    expect(screen.getByText('Enter 2026 or later.')).toBeInTheDocument();
    expect(screen.getByText('Enter a claim age from 62 to 70.')).toBeInTheDocument();
    expect(useScenarioStore.getState().formValues.annualSpendingToday).toBe(220_000);
  });

  it('requires plan-end age to be greater than primary age', () => {
    render(<BasicForm />);

    changeField('Plan-end age', '60');

    expect(screen.queryByText('Plan-end age must be greater than primary age.')).not.toBeInTheDocument();

    changeField('Primary age', '60');

    expect(screen.getByLabelText('Plan-end age')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Plan-end age must be greater than primary age.')).toBeInTheDocument();
  });

  it('debounces valid field values into the scenario store and runs projection', () => {
    render(<BasicForm />);

    changeField('State', 'PA');
    changeField('Primary age', '64');
    changeField('Partner age', '66');
    changeField('Retirement target year', '2027');
    changeField('Plan-end age', '70');
    changeField('Annual spending', '90000');
    changeField('Inflation rate', '0.02');
    changeField('Annual mortgage P&I', '18000');
    changeField('Mortgage payoff year', '2031');
    changeField('Traditional balance', '500000');
    changeField('Roth balance', '100000');
    fireEvent.click(screen.getByLabelText('Auto-deplete brokerage'));
    changeField('Brokerage depletion years', '12');
    changeField('Brokerage annual scale-up factor', '0.03');
    changeField('Brokerage plus cash balance', '250000');
    changeField('Weighted-average taxable basis', '200000');
    changeField('HSA balance', '45000');
    changeField('W-2 income', '180000');
    changeField('Traditional annual contribution', '19000');
    changeField('Roth annual contribution', '7000');
    changeField('HSA annual contribution', '4150');
    changeField('Brokerage annual contribution', '12000');
    changeField('Net consulting income', '25000');
    changeField('Net rental income', '12000');
    changeField('Social Security annual benefit', '40000');
    changeField('Social Security claim age', '67');
    changeField('Pension/annuity annual amount', '15000');
    changeField('Healthcare phase', 'aca');
    changeField('Traditional expected return', '0.06');
    changeField('Roth expected return', '0.07');
    changeField('Brokerage expected return', '0.04');
    changeField('HSA expected return', '0.03');
    changeField('Brokerage dividend yield', '0.02');
    changeField('Qualified dividend percentage', '0.95');

    expect(useScenarioStore.getState().formValues.stateCode).toBe('CA');

    advanceLiveDebounce();

    const state = useScenarioStore.getState();

    expect(state.formValues).toMatchObject({
      filingStatus: 'mfj',
      stateCode: 'PA',
      primaryAge: 64,
      partnerAge: 66,
      retirementYear: 2027,
      planEndAge: 70,
      annualSpendingToday: 90_000,
      inflationRate: 0.02,
      annualMortgagePAndI: 18_000,
      mortgagePayoffYear: 2031,
      annualW2Income: 180_000,
      annualContributionTraditional: 19_000,
      annualContributionRoth: 7_000,
      annualContributionHsa: 4_150,
      annualContributionBrokerage: 12_000,
      annualConsultingIncome: 25_000,
      annualRentalIncome: 12_000,
      annualSocialSecurityBenefit: 40_000,
      socialSecurityClaimAge: 67,
      annualPensionOrAnnuityIncome: 15_000,
      brokerageAndCashBalance: 250_000,
      taxableBrokerageBasis: 200_000,
      hsaBalance: 45_000,
      traditionalBalance: 500_000,
      rothBalance: 100_000,
      autoDepleteBrokerageEnabled: true,
      autoDepleteBrokerageYears: 12,
      autoDepleteBrokerageAnnualScaleUpFactor: 0.03,
      expectedReturnTraditional: 0.06,
      expectedReturnRoth: 0.07,
      expectedReturnBrokerage: 0.04,
      expectedReturnHsa: 0.03,
      brokerageDividendYield: 0.02,
      brokerageQdiPercentage: 0.95,
      healthcarePhase: 'aca',
    });
    expect(state.scenario.state.incomeTaxLaw.stateCode).toBe('PA');
    expect(state.scenario.partnerAge65Plus).toBe(true);
    expect(state.scenario.socialSecurity).toMatchObject({ claimYear: 2029, annualBenefit: 40_000 });
    expect(state.scenario.mortgage).toEqual({ annualPI: 18_000, payoffYear: 2031 });
    expect(state.scenario.inflationRate).toBe(0.02);
    expect(state.scenario.expectedReturns).toEqual({
      cash: 0,
      hsa: 0.03,
      taxableBrokerage: 0.04,
      traditional: 0.06,
      roth: 0.07,
    });
    expect(state.scenario.brokerageDividends).toEqual({ annualYield: 0.02, qdiPercentage: 0.95 });
    expect(state.scenario.autoDepleteBrokerage).toEqual({
      enabled: true,
      yearsToDeplete: 12,
      annualScaleUpFactor: 0.03,
      excludeMortgageFromRate: false,
      retirementYear: 2027,
    });
    expect(state.plan.endYear).toBe(2032);
    expect(state.projectionResults).toHaveLength(7);
    expect(state.scenario.balances.hsa).toBe(45_000);
  });

  it('does not let one invalid field block another valid debounced update', () => {
    render(<BasicForm />);

    changeField('Annual spending', '');
    changeField('W-2 income', '12345');
    advanceLiveDebounce();

    expect(screen.getByText('Annual spending is required.')).toBeInTheDocument();
    expect(useScenarioStore.getState().formValues.annualSpendingToday).toBe(220_000);
    expect(useScenarioStore.getState().formValues.annualW2Income).toBe(12_345);
  });

  it('keeps invalid contribution edits local without blocking unrelated valid updates', () => {
    render(<BasicForm />);

    changeField('Traditional annual contribution', '-1');
    changeField('W-2 income', '12345');
    advanceLiveDebounce();

    expect(screen.getByLabelText('Traditional annual contribution')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Traditional annual contribution must be zero or greater.')).toBeInTheDocument();
    expect(useScenarioStore.getState().formValues.annualContributionTraditional).toBe(0);
    expect(useScenarioStore.getState().formValues.annualW2Income).toBe(12_345);
  });
});
