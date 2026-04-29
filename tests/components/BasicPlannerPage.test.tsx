import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { encodeScenario } from '@/lib/urlHash';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const STORED_FORM_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'single',
  stateCode: 'FL',
  primaryAge: 50,
  partnerAge: 50,
  retirementYear: 2030,
  planEndAge: 80,
  annualSpendingToday: 80_000,
  inflationRate: 0.025,
  annualMortgagePAndI: 0,
  mortgagePayoffYear: 0,
  annualW2Income: 140_000,
  annualContributionTraditional: 0,
  annualContributionRoth: 0,
  annualContributionHsa: 0,
  annualContributionBrokerage: 0,
  annualConsultingIncome: 0,
  annualRentalIncome: 0,
  annualSocialSecurityBenefit: 25_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 0,
  brokerageAndCashBalance: 300_000,
  taxableBrokerageBasis: 250_000,
  hsaBalance: 0,
  traditionalBalance: 500_000,
  rothBalance: 100_000,
  autoDepleteBrokerageEnabled: false,
  autoDepleteBrokerageYears: 10,
  autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
  expectedReturnTraditional: 0.05,
  expectedReturnRoth: 0.05,
  expectedReturnBrokerage: 0.05,
  expectedReturnHsa: 0.05,
  brokerageDividendYield: 0,
  brokerageQdiPercentage: 0.95,
  healthcarePhase: 'none',
};

const HASH_FORM_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'mfj',
  stateCode: 'PA',
  primaryAge: 62,
  partnerAge: 66,
  retirementYear: 2029,
  planEndAge: 92,
  annualSpendingToday: 135_000,
  inflationRate: 0.025,
  annualMortgagePAndI: 0,
  mortgagePayoffYear: 0,
  annualW2Income: 220_000,
  annualContributionTraditional: 0,
  annualContributionRoth: 0,
  annualContributionHsa: 0,
  annualContributionBrokerage: 0,
  annualConsultingIncome: 20_000,
  annualRentalIncome: 12_000,
  annualSocialSecurityBenefit: 55_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 18_000,
  brokerageAndCashBalance: 950_000,
  taxableBrokerageBasis: 700_000,
  hsaBalance: 0,
  traditionalBalance: 1_200_000,
  rothBalance: 320_000,
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

async function importBasicPlannerPage() {
  const [{ BasicPlannerPage }, { STARTER_TEMPLATES }, { DEFAULT_BASIC_FORM_VALUES, useScenarioStore }, { useUiStore }] = await Promise.all([
    import('@/components/BasicPlannerPage'),
    import('@/lib/starterTemplates'),
    import('@/store/scenarioStore'),
    import('@/store/uiStore'),
  ]);

  return { BasicPlannerPage, DEFAULT_BASIC_FORM_VALUES, STARTER_TEMPLATES, useScenarioStore, useUiStore };
}

async function importClassicBasicPlannerPage() {
  const modules = await importBasicPlannerPage();

  modules.useUiStore.getState().setLayout('classic');

  return modules;
}

function advanceLiveDebounce() {
  act(() => {
    vi.advanceTimersByTime(151);
  });
}

describe('BasicPlannerPage', () => {
  beforeEach(() => {
    vi.resetModules();
    installMemoryLocalStorage();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('smokes the live Basic Mode path without a run gate', async () => {
    vi.useFakeTimers();
    const { BasicPlannerPage, useScenarioStore } = await importClassicBasicPlannerPage();

    render(<BasicPlannerPage />);

    expect(screen.getByRole('form', { name: /basic scenario form/i })).toBeInTheDocument();
    expect(screen.queryByText(/run projection/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run projection/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Projection results will appear here/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Run the projection to see/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /projection results/i })).toBeInTheDocument();
    expect(screen.getByText(/Exports use the same visible column contract as the table/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/live projection stats/i)).not.toHaveClass('sticky');
    expect(screen.getByTestId('year-table-scroll')).toHaveClass('max-w-full', 'overflow-x-auto');
    expect(screen.queryByRole('heading', { name: /projection summary/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('live-stat-net-worth-at-retirement')).toHaveTextContent('Net worth at retirement');
    expect(screen.getByTestId('live-stat-plan-end-balance')).toHaveTextContent('Plan-end balance');
    expect(screen.getByTestId('live-stat-years-funded')).toHaveTextContent('Years funded');
    expect(screen.getByRole('heading', { name: /year-by-year projection/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /72\(t\) SEPP IRA size calculator/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/72\(t\) calculator inputs/i)).toBeInTheDocument();
    expect(screen.getByText('Fixed Amortization Method. Independent of your scenario above.')).toBeInTheDocument();
    expect(screen.getByText('$803,990.37')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /can you harvest taxable gains at 0%/i })).not.toBeInTheDocument();

    const averageMagiStat = screen.getByTestId('live-stat-average-bridge-magi');
    const initialAverageMagi = liveStatValue(averageMagiStat);
    fireEvent.change(screen.getByLabelText('Pension/annuity annual amount'), { target: { value: '50000' } });
    advanceLiveDebounce();

    expect(useScenarioStore.getState().formValues.annualPensionOrAnnuityIncome).toBe(50_000);
    expect(liveStatValue(averageMagiStat)).not.toBe(initialAverageMagi);

    const scenarioFormValues = useScenarioStore.getState().formValues;
    fireEvent.change(screen.getByLabelText('Desired annual income'), { target: { value: '60000' } });
    advanceLiveDebounce();

    expect(useScenarioStore.getState().formValues).toEqual(scenarioFormValues);
    expect(useScenarioStore.getState()).not.toHaveProperty('hasRunProjection');
  });

  it('renders the xl workstation structure with a populated results rail', async () => {
    const { BasicPlannerPage } = await importClassicBasicPlannerPage();

    render(<BasicPlannerPage />);

    const layout = screen.getByTestId('basic-workstation-layout');
    const formColumn = screen.getByTestId('basic-form-column');
    const rail = screen.getByTestId('basic-results-rail');
    const railStats = within(rail).getByLabelText(/live projection stats/i);
    const railChart = within(rail).getByRole('img', { name: /stacked account balances/i });
    const tableScroll = screen.getByTestId('year-table-scroll');

    expect(layout).toHaveClass('grid', 'gap-6', 'xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]');
    expect(within(formColumn).getByRole('form', { name: /basic scenario form/i })).toBeInTheDocument();
    expect(rail).toHaveClass(
      'mt-6',
      'min-w-0',
      'xl:sticky',
      'xl:top-4',
      'xl:max-h-[calc(100vh-2rem)]',
      'xl:overflow-y-auto',
      'xl:overscroll-contain',
    );
    expect(rail.className).not.toMatch(/\boverflow-hidden\b/);
    expect(within(rail).getByRole('heading', { name: /projection snapshot/i })).toBeInTheDocument();
    expect(railStats).toHaveClass('mt-4');
    expect(railStats).not.toHaveClass('sticky', 'top-0', 'z-10');
    expect(within(rail).getByRole('heading', { name: /account balances/i })).toBeInTheDocument();
    expect(railChart).toHaveClass('max-w-full', 'overflow-x-auto');
    expect(within(rail).queryByText(/no projection data available/i)).not.toBeInTheDocument();
    expect(rail).not.toContainElement(tableScroll);
    expect(tableScroll).toHaveClass('max-w-full', 'overflow-x-auto');
  });

  it('renders the verdict layout in answer-first order with collapsed details and tools', async () => {
    const { BasicPlannerPage, useUiStore } = await importBasicPlannerPage();
    useUiStore.getState().setLayout('verdict');

    const { container } = render(<BasicPlannerPage />);
    const answer = container.querySelector('[aria-label="Plan answer"]');
    const whatIfCards = screen.getByRole('heading', { name: 'What can you change?' }).closest('section');
    const formArea = container.querySelector('#adjust-your-plan');
    const projectionDetails = screen.getByText('Show the detailed math').closest('details');
    const secondaryTools = screen.getByText('Show starter tools').closest('details');

    expect(screen.getByRole('heading', { name: /plan dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('Plan verdict')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /account balances/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /could a roth ladder reduce future ira taxes/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /can you harvest taxable gains at 0%/i })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: /basic scenario form/i })).toBeInTheDocument();
    expect(answer).not.toBeNull();
    expect(whatIfCards).not.toBeNull();
    expect(formArea).not.toBeNull();
    expect(projectionDetails).not.toBeNull();
    expect(secondaryTools).not.toBeNull();
    expect(answer?.compareDocumentPosition(whatIfCards as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(whatIfCards?.compareDocumentPosition(formArea as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(formArea?.compareDocumentPosition(projectionDetails as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(projectionDetails).not.toHaveAttribute('open');
    expect(secondaryTools).not.toHaveAttribute('open');

    (projectionDetails as HTMLDetailsElement).open = true;
    fireEvent(projectionDetails as HTMLDetailsElement, new Event('toggle'));

    expect(useUiStore.getState().advancedDisclosed).toBe(true);
    expect(screen.getByLabelText(/live projection stats/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /year-by-year projection/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /magi thresholds/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tax breakdown/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /advanced planner/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Planner controls' })).toBeInTheDocument();

    (secondaryTools as HTMLDetailsElement).open = true;

    expect(screen.getByRole('heading', { name: /sample scenarios/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /72\(t\) SEPP IRA size calculator/i })).toBeInTheDocument();
  });

  it('keeps invalid basic form edits local until a valid debounced value is entered', async () => {
    vi.useFakeTimers();
    const { BasicPlannerPage, useScenarioStore } = await importClassicBasicPlannerPage();

    render(<BasicPlannerPage />);

    const annualSpendingInput = screen.getByLabelText('Annual spending');
    const initialAnnualSpending = useScenarioStore.getState().formValues.annualSpendingToday;

    fireEvent.change(annualSpendingInput, { target: { value: '-1' } });
    advanceLiveDebounce();

    expect(annualSpendingInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Annual spending must be zero or greater.')).toBeInTheDocument();
    expect(useScenarioStore.getState().formValues.annualSpendingToday).toBe(initialAnnualSpending);

    fireEvent.change(annualSpendingInput, { target: { value: '91000' } });
    advanceLiveDebounce();

    expect(annualSpendingInput).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Annual spending must be zero or greater.')).not.toBeInTheDocument();
    expect(useScenarioStore.getState().formValues.annualSpendingToday).toBe(91_000);
  });

  it('loads starter templates through the scenario store and refreshes visible form values', async () => {
    vi.useFakeTimers();
    const { BasicPlannerPage, DEFAULT_BASIC_FORM_VALUES, STARTER_TEMPLATES, useScenarioStore } =
      await importClassicBasicPlannerPage();

    render(<BasicPlannerPage />);

    expect(screen.getByRole('heading', { name: /sample scenarios/i })).toBeInTheDocument();
    const explanation = screen.getByText(/Samples update the projection instantly/i);
    expect(explanation).toHaveTextContent(/quick contrasts after reviewing the default household/i);
    expect(explanation.tagName).toBe('P');

    const initialProjectionResults = useScenarioStore.getState().projectionResults;
    const brokerageBridgeTemplate = STARTER_TEMPLATES[0];
    fireEvent.click(screen.getByRole('button', { name: /brokerage bridge with 72\(t\) context/i }));

    expect(useScenarioStore.getState().formValues).toEqual({
      ...DEFAULT_BASIC_FORM_VALUES,
      ...brokerageBridgeTemplate.formValues,
    });
    expect(useScenarioStore.getState().projectionResults).not.toBe(initialProjectionResults);
    expect(screen.getByLabelText('State')).toHaveValue(brokerageBridgeTemplate.formValues.stateCode);
    expect(screen.getByLabelText('Annual spending')).toHaveValue(
      String(brokerageBridgeTemplate.formValues.annualSpendingToday),
    );
    expect(screen.getByLabelText('Auto-deplete brokerage')).toBeChecked();
    expect(
      screen.getByText(`Loaded '${brokerageBridgeTemplate.label}' — change any field to customize.`),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(
      screen.queryByText(`Loaded '${brokerageBridgeTemplate.label}' — change any field to customize.`),
    ).not.toBeInTheDocument();

    const rothLadderTemplate = STARTER_TEMPLATES[1];
    fireEvent.click(screen.getByRole('button', { name: /roth ladder bridge/i }));

    expect(useScenarioStore.getState().formValues).toEqual({
      ...DEFAULT_BASIC_FORM_VALUES,
      ...rothLadderTemplate.formValues,
    });
    expect(screen.getByLabelText('State')).toHaveValue(rothLadderTemplate.formValues.stateCode);
    expect(screen.getByLabelText('Annual mortgage P&I')).toHaveValue(
      String(rothLadderTemplate.formValues.annualMortgagePAndI),
    );
    expect(screen.getByText(`Loaded '${rothLadderTemplate.label}' — change any field to customize.`)).toBeInTheDocument();
  });

  it('cleans up starter template confirmation timers on unmount', async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { BasicPlannerPage } = await importClassicBasicPlannerPage();

    const { unmount } = render(<BasicPlannerPage />);
    fireEvent.click(screen.getByRole('button', { name: /brokerage bridge with 72\(t\) context/i }));

    expect(screen.getByText(/change any field to customize/i)).toBeInTheDocument();

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('hydrates a valid URL hash before localStorage and renders dependent outputs', async () => {
    window.localStorage.setItem(
      'fire-planner.scenario.v1',
      JSON.stringify({
        formValues: STORED_FORM_VALUES,
      }),
    );
    window.location.hash = encodeScenario(mapBasicFormToProjectionInputs(HASH_FORM_VALUES));

    const { BasicPlannerPage, useScenarioStore } = await importClassicBasicPlannerPage();

    render(<BasicPlannerPage />);

    expect(useScenarioStore.getState().formValues.stateCode).toBe('PA');
    expect(useScenarioStore.getState()).not.toHaveProperty('hasRunProjection');
    expect(screen.getByLabelText('State')).toHaveValue('PA');
    expect(screen.queryByRole('heading', { name: /projection summary/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/live projection stats/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /year-by-year projection/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /account balances/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /magi thresholds/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tax breakdown/i })).toBeInTheDocument();
  });

  it('ignores malformed URL hashes without crashing and still renders stored results', async () => {
    window.localStorage.setItem(
      'fire-planner.scenario.v1',
      JSON.stringify({
        formValues: STORED_FORM_VALUES,
      }),
    );
    window.location.hash = '#v1:not-valid-compressed-data';

    const { BasicPlannerPage, useScenarioStore } = await importClassicBasicPlannerPage();

    render(<BasicPlannerPage />);

    expect(useScenarioStore.getState().formValues.stateCode).toBe('FL');
    expect(useScenarioStore.getState()).not.toHaveProperty('hasRunProjection');
    expect(screen.getByLabelText('State')).toHaveValue('FL');
    expect(screen.queryByText(/Projection results will appear here/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /projection summary/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/live projection stats/i)).toBeInTheDocument();
  });
});

function liveStatValue(stat: HTMLElement): string | null {
  return stat.querySelector('.tabular-nums')?.textContent ?? null;
}
