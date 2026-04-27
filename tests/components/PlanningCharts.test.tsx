import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAcaFplBands,
  buildIrmaaThresholds,
  buildMagiChartData,
  MagiChart,
} from '@/components/charts/MagiChart';
import { buildTaxBreakdownChartData, TaxBreakdownChart } from '@/components/charts/TaxBreakdownChart';
import type { AccountBalances, YearBreakdown } from '@/core/projection';
import { useScenarioStore } from '@/store/scenarioStore';
import { useUiStore } from '@/store/uiStore';

import { installMemoryLocalStorage } from '../store/memoryStorage';

const ZERO_BALANCES: AccountBalances = {
  cash: 0,
  taxableBrokerage: 0,
  traditional: 0,
  roth: 0,
};

const CHART_FIXTURE: readonly YearBreakdown[] = [
  buildYearBreakdown({
    acaMagi: 80_000,
    aptcReconciliation: {
      allowedPremiumTaxCredit: 3_000,
      advancePremiumTaxCredit: 0,
      excessAdvancePremiumTaxCredit: 0,
      isRepaymentCapped: false,
      netPremiumTaxCredit: 3_000,
      repaymentAmount: 0,
      repaymentCap: null,
    },
    federalTax: 12_000,
    irmaaMagi: 210_000,
    irmaaPremium: {
      annualIrmaaSurcharge: 1_148.4,
      annualTotal: 3_583.2,
      magiSourceYear: 2024,
      magiUsed: 220_000,
      partBMonthlyAdjustment: 81.2,
      partDMonthlyAdjustment: 14.5,
      standardPartBPremium: 202.9,
      tier: 1,
    },
    ltcgTax: 500,
    niit: 250,
    seTax: 1_200,
    stateTax: 2_500,
    year: 2026,
  }),
  buildYearBreakdown({
    acaMagi: 92_000,
    aptcReconciliation: {
      allowedPremiumTaxCredit: 2_500,
      advancePremiumTaxCredit: 0,
      excessAdvancePremiumTaxCredit: 0,
      isRepaymentCapped: false,
      netPremiumTaxCredit: 2_500,
      repaymentAmount: 0,
      repaymentCap: null,
    },
    federalTax: 13_000,
    irmaaMagi: 230_000,
    irmaaPremium: {
      annualIrmaaSurcharge: 1_148.4,
      annualTotal: 3_583.2,
      magiSourceYear: 2025,
      magiUsed: 230_000,
      partBMonthlyAdjustment: 81.2,
      partDMonthlyAdjustment: 14.5,
      standardPartBPremium: 202.9,
      tier: 1,
    },
    ltcgTax: 700,
    niit: 300,
    seTax: 1_400,
    stateTax: 2_700,
    year: 2027,
  }),
];

let consoleError: ReturnType<typeof vi.spyOn>;

function buildYearBreakdown(values: Partial<YearBreakdown> & Pick<YearBreakdown, 'year'>): YearBreakdown {
  return {
    year: values.year,
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
    acaMagi: values.acaMagi ?? 0,
    irmaaMagi: values.irmaaMagi ?? 0,
    federalTax: values.federalTax ?? 0,
    stateTax: values.stateTax ?? 0,
    ltcgTax: values.ltcgTax ?? 0,
    niit: values.niit ?? 0,
    seTax: values.seTax ?? 0,
    qbiDeduction: 0,
    taxableSocialSecurity: 0,
    acaPremiumCredit: values.acaPremiumCredit ?? null,
    aptcReconciliation: values.aptcReconciliation ?? null,
    irmaaPremium: values.irmaaPremium ?? null,
    totalTax: 0,
    afterTaxCashFlow: 0,
    warnings: [],
    closingBalances: ZERO_BALANCES,
  };
}

function installFixtureState() {
  const current = useScenarioStore.getState();

  useScenarioStore.setState({
    projectionResults: CHART_FIXTURE,
    scenario: {
      ...current.scenario,
      filingStatus: 'mfj',
      healthcare: [
        {
          year: 2026,
          kind: 'aca',
          householdSize: 2,
          annualBenchmarkPremium: 18_000,
          annualEnrollmentPremium: 16_000,
          region: 'contiguous',
        },
      ],
      inflationRate: 0.03,
      startYear: 2026,
    },
  });
}

describe('Planning charts', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    useUiStore.getState().resetUiPreferences();
    useScenarioStore.getState().resetScenario();
    installFixtureState();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    cleanup();
  });

  it('renders MAGI lines, ACA FPL bands, and labeled IRMAA thresholds on fixture projection data', () => {
    const { container } = render(<MagiChart />);

    expect(screen.getByRole('heading', { name: 'MAGI thresholds' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /magi compared with aca fpl bands/i })).toBeInTheDocument();
    expect(screen.getByText('ACA MAGI')).toBeInTheDocument();
    expect(screen.getByText('IRMAA MAGI')).toBeInTheDocument();
    expect(screen.getByText(/100-150% FPL/i)).toBeInTheDocument();
    expect(screen.getAllByText(/IRMAA tier 1/i).length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(2);
  });

  it('builds MAGI threshold data from scenario healthcare and filing status', () => {
    const state = useScenarioStore.getState();
    const magiData = buildMagiChartData(CHART_FIXTURE);
    const acaBands = buildAcaFplBands({ projectionResults: CHART_FIXTURE, scenario: state.scenario });
    const irmaaThresholds = buildIrmaaThresholds(state.scenario.filingStatus);

    expect(magiData[0]).toMatchObject({ acaMagi: 80_000, irmaaMagi: 210_000, year: 2026 });
    expect(acaBands[0]).toMatchObject({
      from: 21_150,
      label: '100-150% FPL',
      to: 31_725,
    });
    expect(irmaaThresholds[0]).toEqual({ label: 'IRMAA tier 1', value: 218_000 });
  });

  it('renders tax components with ACA premium credit as a negative bar value', () => {
    const { container } = render(<TaxBreakdownChart />);
    const state = useScenarioStore.getState();
    const data = buildTaxBreakdownChartData({
      displayUnit: 'nominal',
      projectionResults: CHART_FIXTURE,
      scenario: state.scenario,
    });

    expect(screen.getByRole('heading', { name: 'Tax breakdown' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /annual tax breakdown/i })).toBeInTheDocument();
    expect(screen.getByText('Federal tax')).toBeInTheDocument();
    expect(screen.getByText('State tax')).toBeInTheDocument();
    expect(screen.getByText('LTCG tax')).toBeInTheDocument();
    expect(screen.getByText('NIIT')).toBeInTheDocument();
    expect(screen.getByText('SE tax')).toBeInTheDocument();
    expect(screen.getByText('IRMAA premiums')).toBeInTheDocument();
    expect(screen.getByText('ACA premium credit')).toBeInTheDocument();
    expect(data[0]).toMatchObject({
      acaPremiumCredit: -3_000,
      federalTax: 12_000,
      irmaaPremium: 1_148.4,
      stateTax: 2_500,
    });
    expect(container.querySelectorAll('.recharts-bar')).toHaveLength(7);
  });
});
