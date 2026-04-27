import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BasicForm } from '@/components/BasicForm';
import { useScenarioStore } from '@/store/scenarioStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

function changeField(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('BasicForm', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useScenarioStore.getState().resetScenario();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the supported Gate 3 basic fields with defaults and a responsive grid', () => {
    render(<BasicForm />);

    expect(screen.getByRole('form', { name: /basic scenario form/i })).toHaveClass('sm:grid-cols-2');
    expect(screen.getByLabelText('Filing status')).toHaveValue('mfj');
    expect(screen.getByLabelText('State')).toHaveValue('CA');
    expect(screen.getByLabelText('Primary age')).toBeInTheDocument();
    expect(screen.getByLabelText('Partner age')).toBeInTheDocument();
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
    expect(screen.queryByLabelText(/hsa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hsa/i)).not.toBeInTheDocument();
  });

  it('shows partner age only for married filing jointly', () => {
    render(<BasicForm />);

    expect(screen.getByLabelText('Partner age')).toBeInTheDocument();

    changeField('Filing status', 'single');

    expect(screen.queryByLabelText('Partner age')).not.toBeInTheDocument();

    changeField('Filing status', 'mfj');

    expect(screen.getByLabelText('Partner age')).toBeInTheDocument();
  });

  it('highlights blank required fields and out-of-range values', () => {
    render(<BasicForm />);

    changeField('Annual spending', '');
    changeField('Primary age', '17');
    changeField('Partner age', '111');
    changeField('Retirement target year', '2025');
    changeField('Social Security claim age', '71');

    fireEvent.click(screen.getByRole('button', { name: /run projection/i }));

    expect(screen.getByLabelText('Annual spending')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Annual spending is required.')).toBeInTheDocument();
    expect(screen.getAllByText('Enter an age from 18 to 110.')).toHaveLength(2);
    expect(screen.getByText('Enter 2026 or later.')).toBeInTheDocument();
    expect(screen.getByText('Enter a claim age from 62 to 70.')).toBeInTheDocument();
    expect(useScenarioStore.getState().formValues.annualSpendingToday).toBe(100_000);
  });

  it('requires plan-end age to be greater than primary age', () => {
    render(<BasicForm />);

    changeField('Primary age', '60');
    changeField('Plan-end age', '60');

    fireEvent.click(screen.getByRole('button', { name: /run projection/i }));

    expect(screen.getByLabelText('Plan-end age')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Plan-end age must be greater than primary age.')).toBeInTheDocument();
  });

  it('submits valid form values through the scenario store and runs projection', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /run projection/i }));

    const state = useScenarioStore.getState();

    expect(screen.getByRole('status')).toHaveTextContent('Scenario updated.');
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
});
