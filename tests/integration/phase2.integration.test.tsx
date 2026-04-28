import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { balanceSweepContract } from '@/lib/exportContracts';
import { mapBasicFormToProjectionInputs } from '@/lib/basicFormMapping';
import { methodologySections } from '@/lib/methodologyContent';
import { STARTER_TEMPLATES, type StarterTemplate } from '@/lib/starterTemplates';
import { useScenarioStore } from '@/store/scenarioStore';
import { useScenariosStore } from '@/store/scenariosStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ReferenceArea: () => null,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe('Phase 2 integration smoke', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
    useScenariosStore.setState({ scenarios: [] });
    window.history.replaceState(null, '', '/planner?case=phase2');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('exercises methodology, LTCG template, exports, compare metrics, and balance sweep behavior', () => {
    const downloads = installDownloadMocks();
    const ltcgTemplate = templateById('ltcg-harvest');
    const acaTemplate = templateById('aca-optimized');

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Methodology' }));

    expect(screen.getByRole('heading', { name: 'Methodology' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(
      methodologySections.map((section) => section.title),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Basic' }));

    expect(screen.getByRole('heading', { name: 'Basic planner' })).toBeInTheDocument();

    const initialProjectionResults = useScenarioStore.getState().projectionResults;
    const initialRetirementNetWorth = liveStatValue('net-worth-at-retirement');

    fireEvent.click(screen.getByRole('button', { name: /LTCG harvest bridge/i }));

    expect(useScenarioStore.getState().formValues).toMatchObject(ltcgTemplate.formValues);
    expect(screen.getByLabelText('Filing status')).toHaveValue('mfj');
    expect(screen.getByLabelText('Brokerage plus cash balance')).toHaveValue(
      String(ltcgTemplate.formValues.brokerageAndCashBalance),
    );
    expect(useScenarioStore.getState().projectionResults).not.toBe(initialProjectionResults);
    expect(useScenarioStore.getState().projectionResults.length).toBeGreaterThan(0);
    expect(liveStatValue('net-worth-at-retirement')).not.toBe(initialRetirementNetWorth);
    expect(numericMoney(liveStatValue('net-worth-at-retirement'))).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download JSON' }));

    expect(downloads.createObjectURL).toHaveBeenCalledTimes(2);
    expect(downloads.createObjectURL).toHaveBeenNthCalledWith(1, expect.any(Blob));
    expect(downloads.createObjectURL).toHaveBeenNthCalledWith(2, expect.any(Blob));
    expect(downloads.objectUrls).toEqual(['blob:phase2-1', 'blob:phase2-2']);
    expect(downloads.anchorClick).toHaveBeenCalledTimes(2);
    expect(downloads.revokeObjectURL).toHaveBeenCalledWith('blob:phase2-1');
    expect(downloads.revokeObjectURL).toHaveBeenCalledWith('blob:phase2-2');

    const currentState = useScenarioStore.getState();
    const ltcgSavedScenario = useScenariosStore.getState().save({
      name: 'LTCG harvest smoke',
      plan: currentState.plan,
      scenario: currentState.scenario,
    });
    const acaInputs = mapBasicFormToProjectionInputs({ ...useScenarioStore.getState().formValues, ...acaTemplate.formValues });

    useScenariosStore.getState().save({
      name: 'ACA optimized smoke',
      plan: acaInputs.plan,
      scenario: acaInputs.scenario,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByRole('heading', { name: 'Compare two scenarios' })).toBeInTheDocument();

    const headlineSection = screen.getByRole('heading', { name: 'Headline metrics' }).closest('section');
    expect(headlineSection).not.toBeNull();

    const headlineTable = within(headlineSection as HTMLElement).getByRole('table');

    expect(within(headlineTable).getByText('Total bridge tax')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Average bridge MAGI')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Max withdrawal rate')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Years above 400% FPL cliff')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Years touching IRMAA')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Brokerage basis remaining at retirement')).toBeInTheDocument();
    expect(within(headlineTable).getByText('Ending account mix')).toBeInTheDocument();
    expect(screen.getAllByText('LTCG harvest smoke').length).toBeGreaterThan(0);
    expect(screen.getByTestId(`ending-account-mix-${ltcgSavedScenario.id}`)).toHaveTextContent(/Brokerage \d+%/);

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Manual plan' }));

    const planBeforeBalanceAttempt = useScenarioStore.getState().plan;

    expect(balanceSweepContract.supported).toBe(false);
    expect(screen.getByRole('button', { name: 'Balance all years' })).toBeDisabled();
    expect(screen.getByText(/Account-specific manual withdrawal overrides are deferred/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Balance all years' }));

    expect(useScenarioStore.getState().plan).toEqual(planBeforeBalanceAttempt);
  }, 10_000);
});

function installDownloadMocks() {
  const objectUrls: string[] = [];
  const createObjectURL = vi.fn(() => {
    const objectUrl = `blob:phase2-${objectUrls.length + 1}`;
    objectUrls.push(objectUrl);

    return objectUrl;
  });
  const revokeObjectURL = vi.fn();
  const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURL,
  });

  return { anchorClick, createObjectURL, objectUrls, revokeObjectURL };
}

function liveStatValue(id: string): string {
  return screen.getByTestId(`live-stat-${id}`).querySelector('.tabular-nums')?.textContent ?? '';
}

function numericMoney(value: string): number {
  return Number(value.replace(/[^-\d]/g, ''));
}

function templateById(id: StarterTemplate['id']): StarterTemplate {
  const template = STARTER_TEMPLATES.find((candidate) => candidate.id === id);

  if (template === undefined) {
    throw new Error(`Missing starter template: ${id}`);
  }

  return template;
}
