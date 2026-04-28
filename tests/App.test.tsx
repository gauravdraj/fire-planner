import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App, CUSTOM_LAW_BANNER_TEXT } from '@/App';
import { DISCLAIMER_TEXT } from '@/components/Disclaimer';
import { SHARE_LINK_ACKNOWLEDGED_KEY } from '@/components/ShareButton';
import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { decodeScenario } from '@/lib/urlHash';
import { useScenarioStore } from '@/store/scenarioStore';
import { useScenariosStore } from '@/store/scenariosStore';
import { UI_STORAGE_KEY, useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from './store/memoryStorage';

const BASE_FORM_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'single',
  stateCode: 'FL',
  primaryAge: 52,
  partnerAge: 52,
  retirementYear: 2030,
  planEndAge: 70,
  annualSpendingToday: 80_000,
  annualMortgagePAndI: 0,
  mortgagePayoffYear: 0,
  annualW2Income: 150_000,
  annualConsultingIncome: 0,
  annualRentalIncome: 0,
  annualSocialSecurityBenefit: 24_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 0,
  brokerageAndCashBalance: 400_000,
  taxableBrokerageBasis: 300_000,
  hsaBalance: 0,
  traditionalBalance: 600_000,
  rothBalance: 125_000,
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

describe('App', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
    useScenariosStore.setState({ scenarios: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the shell in disclaimer, header, main, footer order when tax data is fresh', () => {
    const { container } = render(<App />);
    const shell = container.firstElementChild;
    const headerShell = container.querySelector('header > div');
    const footerShell = container.querySelector('footer > div');
    const main = container.querySelector('main');

    expect(shell?.children).toHaveLength(4);
    expect(shell?.children[0]).toHaveTextContent(DISCLAIMER_TEXT);
    expect(shell?.children[1]?.tagName).toBe('HEADER');
    expect(shell?.children[2]?.tagName).toBe('MAIN');
    expect(shell?.children[3]?.tagName).toBe('FOOTER');
    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fire Planner' })).toBeInTheDocument();
    expect(
      screen.getByText('Free, open-source, client-only, fixture-validated, transparent FIRE planning.'),
    ).toBeInTheDocument();
    expect(screen.getByText('All inputs stay on your device.')).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER_TEXT)).toHaveClass('lg:max-w-6xl', 'xl:max-w-7xl');
    expect(headerShell).toHaveClass('lg:max-w-6xl', 'xl:max-w-7xl');
    expect(main).toHaveClass('lg:max-w-6xl', 'xl:max-w-7xl');
    expect(footerShell).toHaveClass('lg:max-w-6xl', 'xl:max-w-7xl');
  });

  it('persists mode changes and renders only the advanced Gate 4 shell', () => {
    useClassicLayout();

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

    expect(screen.getByRole('heading', { name: 'Advanced planner' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Custom law' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Manual plan' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Planner controls' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Planning charts' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Scenarios' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Basic planner' })).not.toBeInTheDocument();
    expect(useUiStore.getState()).toMatchObject({ advancedDisclosed: true, mode: 'advanced', view: 'plan' });
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({
      advancedDisclosed: true,
      mode: 'advanced',
      view: 'plan',
    });
  });

  it('routes to compare as a top-level view without a router dependency', () => {
    saveNamedScenario('Baseline', BASE_FORM_VALUES);
    saveNamedScenario('Harvest plan', {
      ...BASE_FORM_VALUES,
      annualSpendingToday: 95_000,
      brokerageAndCashBalance: 650_000,
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByRole('heading', { name: 'Compare two scenarios' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scenario summaries' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Basic planner' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Advanced planner' })).not.toBeInTheDocument();
    expect(useUiStore.getState()).toMatchObject({ mode: 'compare', view: 'compare' });
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({
      mode: 'compare',
      view: 'compare',
    });
  });

  it('routes to methodology as a top-level view without rendering planner content', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('link', { name: 'Methodology' }));

    expect(useUiStore.getState()).toMatchObject({ mode: 'methodology', view: 'methodology' });
    expect(screen.getByRole('heading', { name: 'Methodology' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "What this tool is and isn't" })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Basic planner' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Advanced planner' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Compare two scenarios' })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({
      mode: 'methodology',
      view: 'methodology',
    });
  });

  it('launches compare from the advanced scenario manager', () => {
    const first = saveNamedScenario('Baseline', BASE_FORM_VALUES);
    const second = saveNamedScenario('Harvest plan', {
      ...BASE_FORM_VALUES,
      annualSpendingToday: 95_000,
      brokerageAndCashBalance: 650_000,
    });
    useClassicLayout();

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Scenarios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage scenarios' }));
    fireEvent.click(screen.getByLabelText('Select Baseline for comparison'));
    fireEvent.click(screen.getByLabelText('Select Harvest plan for comparison'));
    fireEvent.click(screen.getByRole('button', { name: 'Compare selected scenarios' }));

    expect(useUiStore.getState()).toMatchObject({ mode: 'compare', view: 'compare' });
    expect(screen.getByRole('heading', { name: 'Compare two scenarios' })).toBeInTheDocument();
    expect(screen.getByLabelText('First saved scenario')).toHaveValue(first.id);
    expect(screen.getByLabelText('Second saved scenario')).toHaveValue(second.id);
    expect(screen.queryByRole('heading', { name: 'Advanced planner' })).not.toBeInTheDocument();
  });

  it('launches compare from the verdict advanced disclosure scenario manager', () => {
    const first = saveNamedScenario('Baseline', BASE_FORM_VALUES);
    const second = saveNamedScenario('Harvest plan', {
      ...BASE_FORM_VALUES,
      annualSpendingToday: 95_000,
      brokerageAndCashBalance: 650_000,
    });

    render(<App />);

    const advancedDetails = screen.getByText('Show the detailed math').closest('details');
    expect(advancedDetails).not.toBeNull();
    (advancedDetails as HTMLDetailsElement).open = true;
    fireEvent(advancedDetails as HTMLDetailsElement, new Event('toggle'));

    fireEvent.click(screen.getByRole('tab', { name: 'Scenarios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage scenarios' }));
    fireEvent.click(screen.getByLabelText('Select Baseline for comparison'));
    fireEvent.click(screen.getByLabelText('Select Harvest plan for comparison'));
    fireEvent.click(screen.getByRole('button', { name: 'Compare selected scenarios' }));

    expect(useUiStore.getState()).toMatchObject({ mode: 'compare', view: 'compare' });
    expect(screen.getByRole('heading', { name: 'Compare two scenarios' })).toBeInTheDocument();
    expect(screen.getByLabelText('First saved scenario')).toHaveValue(first.id);
    expect(screen.getByLabelText('Second saved scenario')).toHaveValue(second.id);
    expect(screen.queryByRole('heading', { name: 'Plan dashboard' })).not.toBeInTheDocument();
  });

  it('defaults to the verdict Plan dashboard while keeping Basic compatibility state', () => {
    render(<App />);

    expect(useUiStore.getState()).toMatchObject({ layout: 'verdict', mode: 'basic', view: 'plan' });
    expect(screen.getByRole('heading', { name: 'Plan dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Basic planner' })).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: /basic scenario form/i })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Planner mode' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Plan navigation' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Planner layout' })).toBeInTheDocument();
    expect(screen.queryByText(CUSTOM_LAW_BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('shows the custom-law banner across mode switches and hides it after reset all', () => {
    useScenarioStore.getState().setCustomLaw({
      federal: {
        standardDeduction: {
          single: 20_000,
        },
      },
    });
    useClassicLayout();

    render(<App />);

    expect(screen.getByText(CUSTOM_LAW_BANNER_TEXT)).toBeInTheDocument();
    expect(screen.getByText(CUSTOM_LAW_BANNER_TEXT)).toHaveClass('lg:max-w-6xl', 'xl:max-w-7xl');
    expect(screen.getByRole('heading', { name: 'Basic planner' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

    expect(screen.getByText(CUSTOM_LAW_BANNER_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Advanced planner' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset all custom-law overrides' }));

    expect(screen.queryByText(CUSTOM_LAW_BANNER_TEXT)).not.toBeInTheDocument();
    expect(useScenarioStore.getState().customLaw).toBeUndefined();
    expect(useScenarioStore.getState().customLawActive).toBe(false);
  });

  it('persists display unit changes without changing planner mode', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Nominal dollars' }));

    expect(useUiStore.getState()).toMatchObject({ mode: 'basic', view: 'plan' });
    expect(useUiStore.getState().displayUnit).toBe('nominal');
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({
      displayUnit: 'nominal',
      mode: 'basic',
      view: 'plan',
    });
  });

  it('defaults to verdict, persists layout changes, and keeps Classic available', () => {
    render(<App />);

    expect(useUiStore.getState()).toMatchObject({ mode: 'basic', view: 'plan' });
    expect(useUiStore.getState().layout).toBe('verdict');
    expect(screen.getByRole('heading', { name: 'Plan dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Basic planner' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Planner mode' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Plan navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verdict' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({
      layout: 'verdict',
      mode: 'basic',
      view: 'plan',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));

    expect(useUiStore.getState()).toMatchObject({ mode: 'compare', view: 'compare' });
    expect(screen.getByRole('heading', { name: 'Compare two scenarios' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));

    expect(useUiStore.getState()).toMatchObject({ mode: 'basic', view: 'plan' });
    expect(screen.getByRole('heading', { name: 'Plan dashboard' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Methodology' }));

    expect(useUiStore.getState()).toMatchObject({ mode: 'methodology', view: 'methodology' });
    expect(screen.getByRole('heading', { name: 'Methodology' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));

    expect(useUiStore.getState().layout).toBe('classic');
    expect(screen.getByRole('group', { name: 'Planner mode' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({
      layout: 'classic',
      mode: 'methodology',
      view: 'methodology',
    });
  });

  it('keeps the shell control area accessible while sharing, display, and theme controls coexist', () => {
    render(<App />);

    const controls = screen.getByRole('group', { name: 'Planner controls' });
    const themeSelect = within(controls).getByRole('combobox', { name: 'Theme' });
    const shareButton = within(controls).getByRole('button', { name: 'Share' });

    expect(controls).toHaveClass('flex-wrap', 'items-center');
    expect(within(controls).getByRole('group', { name: 'Plan navigation' })).toHaveClass('flex-wrap');
    expect(within(controls).queryByRole('group', { name: 'Planner mode' })).not.toBeInTheDocument();
    expect(within(controls).getByRole('group', { name: 'Display dollars' })).toHaveClass('flex-wrap');
    expect(within(controls).getByRole('group', { name: 'Planner layout' })).toHaveClass('flex-wrap');
    expect(themeSelect).toHaveAttribute('aria-label', 'Theme');
    expect(themeSelect).toHaveClass('h-10');
    expect(themeSelect.closest('label')).toBeNull();
    expect(themeSelect).toHaveValue('system');
    expect(within(controls).getByRole('button', { name: 'Real dollars' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(controls).getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(controls).getByRole('button', { name: 'Verdict' })).toHaveAttribute('aria-pressed', 'true');
    expect(shareButton).toHaveClass('h-10');

    fireEvent.click(within(controls).getByRole('button', { name: 'Nominal dollars' }));
    fireEvent.click(shareButton);

    expect(useUiStore.getState().displayUnit).toBe('nominal');
    expect(screen.getByRole('dialog', { name: /share-link privacy/i })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({
      displayUnit: 'nominal',
      layout: 'verdict',
      mode: 'basic',
      view: 'plan',
    });
  });

  it('renders an accessible theme control and applies the selected theme', async () => {
    render(<App />);

    const themeSelect = screen.getByLabelText('Theme');

    expect(themeSelect).toHaveValue('system');

    fireEvent.change(themeSelect, { target: { value: 'dark' } });

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
    });

    expect(useUiStore.getState().themePreference).toBe('dark');
    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({
      displayUnit: 'real',
      mode: 'basic',
      view: 'plan',
      themePreference: 'dark',
    });
  });

  it('switches theme without disturbing planner state, display mode, sharing, or local scenarios', async () => {
    const clipboardWrites = installClipboardMock();
    window.history.replaceState(null, '', '/planner');
    useScenarioStore.getState().replaceFormValues({
      ...BASE_FORM_VALUES,
      annualSpendingToday: 88_000,
      planEndAge: 68,
      primaryAge: 58,
      retirementYear: 2028,
    });
    saveNamedScenario('Theme QA baseline', useScenarioStore.getState().formValues);
    saveNamedScenario('Theme QA alternate', {
      ...BASE_FORM_VALUES,
      annualSpendingToday: 92_000,
      brokerageAndCashBalance: 675_000,
    });
    useUiStore.getState().setMode('advanced');
    useUiStore.getState().setDisplayUnit('nominal');
    useUiStore.getState().setLayout('verdict');
    window.localStorage.setItem(SHARE_LINK_ACKNOWLEDGED_KEY, 'true');

    const scenarioBeforeThemeSwitch = useScenarioStore.getState().scenario;
    const planBeforeThemeSwitch = useScenarioStore.getState().plan;
    const savedScenarioIdsBeforeThemeSwitch = useScenariosStore.getState().scenarios.map((scenario) => scenario.id);

    render(<App />);
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } });

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
    });

    expect(useUiStore.getState()).toMatchObject({
      advancedDisclosed: true,
      displayUnit: 'nominal',
      mode: 'advanced',
      view: 'plan',
      layout: 'verdict',
      themePreference: 'dark',
    });
    expect(useScenarioStore.getState().formValues.annualSpendingToday).toBe(88_000);
    expect(useScenarioStore.getState().scenario.startYear).toBe(scenarioBeforeThemeSwitch.startYear);
    expect(useScenarioStore.getState().plan.endYear).toBe(planBeforeThemeSwitch.endYear);
    expect(useScenariosStore.getState().scenarios.map((scenario) => scenario.id)).toEqual(
      savedScenarioIdsBeforeThemeSwitch,
    );

    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));

    await waitFor(() => expect(clipboardWrites).toHaveLength(1));

    const decodedSharePayload = decodeScenario(new URL(clipboardWrites[0] ?? '').hash);

    expect(decodedSharePayload?.scenario.startYear).toBe(scenarioBeforeThemeSwitch.startYear);
    expect(decodedSharePayload?.plan.endYear).toBe(planBeforeThemeSwitch.endYear);
    expect(decodedSharePayload).not.toHaveProperty('layout');
    expect(useUiStore.getState()).toMatchObject({
      advancedDisclosed: true,
      displayUnit: 'nominal',
      mode: 'advanced',
      view: 'plan',
      layout: 'verdict',
      themePreference: 'dark',
    });
  });
});

function saveNamedScenario(name: string, values: BasicFormValues) {
  const { plan, scenario } = mapBasicFormToProjectionInputs(values);

  return useScenariosStore.getState().save({ name, plan, scenario });
}

function useClassicLayout() {
  useUiStore.getState().setLayout('classic');
}

function installClipboardMock(): string[] {
  const clipboardWrites: string[] = [];

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        clipboardWrites.push(text);
      },
    },
  });

  return clipboardWrites;
}
