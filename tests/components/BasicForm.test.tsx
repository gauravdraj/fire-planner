import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BasicForm } from '@/components/BasicForm';
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
    expect(screen.getByLabelText('Traditional balance')).toBeInTheDocument();
    expect(screen.getByLabelText('Roth balance')).toBeInTheDocument();
    expect(screen.getByLabelText('Brokerage plus cash balance')).toBeInTheDocument();
    expect(screen.getByLabelText('Weighted-average taxable basis')).toBeInTheDocument();
    expect(screen.getByLabelText('W-2 income')).toBeInTheDocument();
    expect(screen.getByLabelText('Net consulting income')).toBeInTheDocument();
    expect(screen.getByLabelText('Net rental income')).toBeInTheDocument();
    expect(screen.getByLabelText('Social Security annual benefit')).toBeInTheDocument();
    expect(screen.getByLabelText('Social Security claim age')).toBeInTheDocument();
    expect(screen.getByLabelText('Pension/annuity annual amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Healthcare phase')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run projection/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/hsa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hsa/i)).not.toBeInTheDocument();
  });

  it('groups fields into the ordered basic form sections', () => {
    const { container } = render(<BasicForm />);
    const fieldsets = Array.from(container.querySelectorAll('fieldset')) as HTMLElement[];

    expect(fieldsets).toHaveLength(6);
    expect(
      fieldsets.map((fieldset) =>
        within(fieldset).getByRole('button', { name: /About / }).getAttribute('aria-label')?.replace('About ', ''),
      ),
    ).toEqual(['Household', 'Timeline', 'Spending', 'Accounts', 'Income', 'Healthcare']);
    for (const fieldset of fieldsets) {
      expect(fieldset).toHaveClass('rounded-md', 'border', 'border-slate-200', 'p-4');
      expect(fieldset.querySelector('legend')).toHaveClass('px-2', 'text-sm', 'font-semibold', 'text-slate-700');
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

    expect(
      within(screen.getByRole('group', { name: /spending/i })).getByLabelText('Annual spending'),
    ).toBeInTheDocument();

    const accounts = screen.getByRole('group', { name: /accounts/i });
    expect(within(accounts).getByLabelText('Traditional balance')).toBeInTheDocument();
    expect(within(accounts).getByLabelText('Roth balance')).toBeInTheDocument();
    expect(within(accounts).getByLabelText('Brokerage plus cash balance')).toBeInTheDocument();
    expect(within(accounts).getByLabelText('Weighted-average taxable basis')).toBeInTheDocument();

    const income = fieldsets[4]!;
    expect(within(income).getByLabelText('W-2 income')).toBeInTheDocument();
    expect(within(income).getByLabelText('Net consulting income')).toBeInTheDocument();
    expect(within(income).getByLabelText('Net rental income')).toBeInTheDocument();
    expect(within(income).getByLabelText('Social Security annual benefit')).toBeInTheDocument();
    expect(within(income).getByLabelText('Pension/annuity annual amount')).toBeInTheDocument();

    expect(
      within(screen.getByRole('group', { name: /healthcare/i })).getByLabelText('Healthcare phase'),
    ).toBeInTheDocument();
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

    expect(screen.getAllByRole('button', { name: /About / })).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'About Household' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Spending' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Income' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Healthcare' })).toBeInTheDocument();

    fireEvent.focus(screen.getByRole('button', { name: 'About Accounts' }));

    expect(
      screen
        .getByText('Starting supported account balances and taxable basis used by the withdrawal display layer.')
        .closest('[role="tooltip"]'),
    ).toHaveTextContent(
      'Starting supported account balances and taxable basis used by the withdrawal display layer.',
    );
  });

  it('renders derived chips and updates them after valid debounced edits', () => {
    render(<BasicForm />);

    expect(screen.getByText('→ Age 64 in 9 yrs')).toHaveClass(
      'text-xs',
      'uppercase',
      'tracking-wide',
      'text-slate-500',
    );
    expect(screen.getByText(/→ Year 1 \$100,000 -> 2066 \$/)).toBeInTheDocument();
    expect(screen.getByText('→ Stops in 2035')).toBeInTheDocument();
    expect(screen.getByText('→ Claims in 2038 at age 67')).toBeInTheDocument();
    expect(screen.getByText('→ Subsidy band unavailable')).toBeInTheDocument();

    changeField('Retirement target year', '2030');
    changeField('Annual spending', '90000');
    changeField('Social Security claim age', '68');
    changeField('Healthcare phase', 'aca');
    advanceLiveDebounce();

    expect(screen.getByText('→ Age 59 in 4 yrs')).toBeInTheDocument();
    expect(screen.getByText(/→ Year 1 \$90,000 -> 2066 \$/)).toBeInTheDocument();
    expect(screen.getByText('→ Stops in 2030')).toBeInTheDocument();
    expect(screen.getByText('→ Claims in 2039 at age 68')).toBeInTheDocument();
    expect(screen.getByText('→ Subsidy band: below 138% FPL')).toBeInTheDocument();

    changeField('Annual spending', '');
    advanceLiveDebounce();

    expect(screen.getByText('Annual spending is required.')).toBeInTheDocument();
    expect(screen.getByText(/→ Year 1 \$90,000 -> 2066 \$/)).toBeInTheDocument();
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
    expect(useScenarioStore.getState().formValues.annualSpendingToday).toBe(100_000);
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
    changeField('Traditional balance', '500000');
    changeField('Roth balance', '100000');
    changeField('Brokerage plus cash balance', '250000');
    changeField('Weighted-average taxable basis', '200000');
    changeField('W-2 income', '180000');
    changeField('Net consulting income', '25000');
    changeField('Net rental income', '12000');
    changeField('Social Security annual benefit', '40000');
    changeField('Social Security claim age', '67');
    changeField('Pension/annuity annual amount', '15000');
    changeField('Healthcare phase', 'aca');

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
      annualW2Income: 180_000,
      annualConsultingIncome: 25_000,
      annualRentalIncome: 12_000,
      annualSocialSecurityBenefit: 40_000,
      socialSecurityClaimAge: 67,
      annualPensionOrAnnuityIncome: 15_000,
      brokerageAndCashBalance: 250_000,
      taxableBrokerageBasis: 200_000,
      traditionalBalance: 500_000,
      rothBalance: 100_000,
      healthcarePhase: 'aca',
    });
    expect(state.scenario.state.incomeTaxLaw.stateCode).toBe('PA');
    expect(state.scenario.partnerAge65Plus).toBe(true);
    expect(state.scenario.socialSecurity).toMatchObject({ claimYear: 2029, annualBenefit: 40_000 });
    expect(state.plan.endYear).toBe(2032);
    expect(state.projectionResults).toHaveLength(7);
    expect(state.scenario.balances).not.toHaveProperty('hsa');
  });

  it('does not let one invalid field block another valid debounced update', () => {
    render(<BasicForm />);

    changeField('Annual spending', '');
    changeField('W-2 income', '12345');
    advanceLiveDebounce();

    expect(screen.getByText('Annual spending is required.')).toBeInTheDocument();
    expect(useScenarioStore.getState().formValues.annualSpendingToday).toBe(100_000);
    expect(useScenarioStore.getState().formValues.annualW2Income).toBe(12_345);
  });
});
