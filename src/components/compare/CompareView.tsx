import { useEffect, useMemo, useState } from 'react';
import {
  computeAverageBridgeAcaMagi,
  computeBridgeAcaCliffYearCount,
  computeBridgeIrmaaTouchedYearCount,
  computeMaxBridgeGrossBucketDrawPercentage,
  computeTotalBridgeTax,
} from '@/core/metrics';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { classNames, formControlClassName } from '@/components/ui/controlStyles';
import { runProjection, type AccountBalances, type Scenario, type WithdrawalPlan, type YearBreakdown } from '@/core/projection';
import { getChartPalette, type ChartPalette } from '@/lib/chartPalette';
import { toReal } from '@/lib/realDollars';
import { useResolvedTheme } from '@/lib/theme';
import { type SavedScenario, useScenariosStore } from '@/store/scenariosStore';
import { type DisplayUnit, useUiStore } from '@/store/uiStore';

import { MetricCell } from '../MetricCell';

type ScenarioIdPair = readonly [string, string];

type CompareViewProps = {
  initialScenarioIds?: ScenarioIdPair | undefined;
};

type MagiVariant = 'acaMagi' | 'irmaaMagi';

type ComparedScenario = Readonly<{
  saved: SavedScenario & { plan: WithdrawalPlan };
  results: readonly YearBreakdown[];
}>;

type CompareBuildResult =
  | Readonly<{ comparedScenarios: readonly ComparedScenario[]; kind: 'ready' }>
  | Readonly<{ kind: 'incomplete'; message: string; title: string }>
  | Readonly<{ kind: 'error'; message: string; title: string }>;

type SummaryCard = Readonly<{
  title: string;
  value: string;
  detail: string;
}>;

type AccountMixKey = 'traditional' | 'roth' | 'taxableBrokerage' | 'hsa';

type AccountMixShare = Readonly<{
  key: AccountMixKey;
  label: string;
  percentage: number;
}>;

type HeadlineMetrics = Readonly<{
  averageBridgeMagi: number | null;
  bridgeYears: readonly YearBreakdown[];
  brokerageBasisAtRetirement: Readonly<{ amount: number; year: number }> | null;
  cliffYearCount: number;
  endingAccountMix: readonly AccountMixShare[];
  irmaaTouchedYearCount: number;
  maxWithdrawalRate: number | null;
  totalBridgeTax: number | null;
}>;

type TaxComponentKey =
  | 'federalTax'
  | 'stateTax'
  | 'ltcgTax'
  | 'niit'
  | 'seTax'
  | 'irmaaPremium'
  | 'acaPremiumCredit';

type TooltipPayloadItem = Readonly<{
  color?: string;
  dataKey?: string | number;
  name?: string;
  value?: number | string;
}>;

const TAX_COMPONENTS: ReadonlyArray<Readonly<{ key: TaxComponentKey; label: string }>> = [
  { key: 'federalTax', label: 'Federal tax' },
  { key: 'stateTax', label: 'State tax' },
  { key: 'ltcgTax', label: 'LTCG tax' },
  { key: 'niit', label: 'NIIT' },
  { key: 'seTax', label: 'SE tax' },
  { key: 'irmaaPremium', label: 'IRMAA premiums' },
  { key: 'acaPremiumCredit', label: 'ACA premium credit' },
];

const BALANCE_KEYS = ['cash', 'hsa', 'taxableBrokerage', 'traditional', 'roth'] as const;
const ACCOUNT_MIX_KEYS: ReadonlyArray<Readonly<{ key: AccountMixKey; label: string; colorClassName: string }>> = [
  { key: 'traditional', label: 'Trad', colorClassName: 'bg-sky-500' },
  { key: 'roth', label: 'Roth', colorClassName: 'bg-violet-500' },
  { key: 'taxableBrokerage', label: 'Brokerage', colorClassName: 'bg-emerald-500' },
  { key: 'hsa', label: 'HSA', colorClassName: 'bg-amber-500' },
];
const MAGI_LABELS: Record<MagiVariant, string> = {
  acaMagi: 'ACA MAGI',
  irmaaMagi: 'IRMAA MAGI',
};

const panelClassName =
  'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none';
const sectionHeadingClassName = 'text-base font-semibold text-slate-950 dark:text-slate-50';
const mutedTextClassName = 'text-sm leading-6 text-slate-600 dark:text-slate-400';
const tableShellClassName =
  'mt-3 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 [contain:paint] dark:border-slate-800 dark:bg-slate-950 dark:shadow-none';
const tableClassName = 'w-full border-separate border-spacing-0 text-sm text-slate-700 dark:text-slate-200';
const tableHeadClassName = 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300';
const tableBodyClassName = 'divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950';
const tableHeaderCellClassName = 'border-b border-slate-200 px-3 py-2 font-medium dark:border-slate-800';
const tableCellClassName = 'border-b border-slate-200 px-3 py-2 dark:border-slate-800';

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  style: 'percent',
});

export function CompareView({ initialScenarioIds }: CompareViewProps) {
  const scenarios = useScenariosStore((state) => state.scenarios);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const themePreference = useUiStore((state) => state.themePreference);
  const resolvedTheme = useResolvedTheme(themePreference);
  const palette = getChartPalette(resolvedTheme);
  const [firstId, setFirstId] = useState(initialScenarioIds?.[0] ?? '');
  const [secondId, setSecondId] = useState(initialScenarioIds?.[1] ?? '');
  const [firstMagiVariant, setFirstMagiVariant] = useState<MagiVariant>('acaMagi');
  const [secondMagiVariant, setSecondMagiVariant] = useState<MagiVariant>('irmaaMagi');

  useEffect(() => {
    if (initialScenarioIds === undefined) {
      return;
    }

    setFirstId(initialScenarioIds[0]);
    setSecondId(initialScenarioIds[1]);
  }, [initialScenarioIds]);

  useEffect(() => {
    setFirstId((current) => (scenarios.some((scenario) => scenario.id === current) ? current : scenarios[0]?.id ?? ''));
  }, [scenarios]);

  useEffect(() => {
    setSecondId((current) => {
      if (current !== firstId && scenarios.some((scenario) => scenario.id === current)) {
        return current;
      }

      return scenarios.find((scenario) => scenario.id !== firstId)?.id ?? '';
    });
  }, [firstId, scenarios]);

  const firstScenario = scenarios.find((scenario) => scenario.id === firstId);
  const secondScenario = scenarios.find((scenario) => scenario.id === secondId);
  const compareState = useMemo(
    () => buildComparedScenarios(firstScenario, secondScenario),
    [firstScenario, secondScenario],
  );
  const unitLabel = displayUnit === 'real' ? "today's dollars" : 'nominal dollars';
  const scenarioCountLabel = scenarios.length === 1 ? '1 saved scenario' : `${scenarios.length} saved scenarios`;

  return (
    <section aria-labelledby="compare-view-heading" className={classNames('mt-5 min-w-0', panelClassName)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-950/40 dark:text-indigo-200">
              Local comparison
            </p>
            <p className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {scenarioCountLabel}
            </p>
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50" id="compare-view-heading">
            Compare two scenarios
          </h2>
          <p className={classNames('mt-2', mutedTextClassName)}>
            Pick exactly two browser-local snapshots to compare summary outcomes, bridge-year risk, annual data, MAGI,
            and tax components.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {unitLabel}
          </p>
          <p className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
            saved IDs stay local
          </p>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <CompareStateCallout
          message="Save the active planner as a local named scenario, then save one alternate plan before using compare."
          title="No saved scenarios yet"
          tone="neutral"
        />
      ) : scenarios.length === 1 ? (
        <CompareStateCallout
          message="You have one local snapshot. Save one more scenario to unlock side-by-side comparison."
          title="One more saved scenario needed"
          tone="warning"
        />
      ) : (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ScenarioSelect
              label="First saved scenario"
              onChange={setFirstId}
              otherSelectedId={secondId}
              scenarios={scenarios}
              value={firstId}
            />
            <ScenarioSelect
              label="Second saved scenario"
              onChange={setSecondId}
              otherSelectedId={firstId}
              scenarios={scenarios}
              value={secondId}
            />
          </div>

          {compareState.kind === 'ready' ? (
            <>
              <CompareStateCallout
                message={`${compareState.comparedScenarios[0]?.saved.name ?? 'First scenario'} and ${
                  compareState.comparedScenarios[1]?.saved.name ?? 'second scenario'
                } are projected with the saved inputs and withdrawal plans from local storage.`}
                title="Exactly two scenarios selected"
                tone="success"
              />
              <SummaryComparison comparedScenarios={compareState.comparedScenarios} displayUnit={displayUnit} />
              <HeadlineMetricsComparison comparedScenarios={compareState.comparedScenarios} displayUnit={displayUnit} />
              <CombinedYearTable comparedScenarios={compareState.comparedScenarios} displayUnit={displayUnit} />
              <MagiOverlay
                comparedScenarios={compareState.comparedScenarios}
                firstMagiVariant={firstMagiVariant}
                onFirstMagiVariantChange={setFirstMagiVariant}
                onSecondMagiVariantChange={setSecondMagiVariant}
                palette={palette}
                secondMagiVariant={secondMagiVariant}
              />
              <TaxBreakdownComparison comparedScenarios={compareState.comparedScenarios} displayUnit={displayUnit} />
            </>
          ) : (
            <CompareStateCallout message={compareState.message} title={compareState.title} tone={compareState.kind === 'error' ? 'error' : 'warning'} />
          )}
        </>
      )}
    </section>
  );
}

function ScenarioSelect({
  label,
  onChange,
  otherSelectedId,
  scenarios,
  value,
}: {
  label: string;
  onChange: (id: string) => void;
  otherSelectedId: string;
  scenarios: readonly SavedScenario[];
  value: string;
}) {
  const id = label.toLowerCase().replaceAll(/\s+/g, '-');

  return (
    <div>
      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200" htmlFor={id}>
        {label}
      </label>
      <select
        className={classNames(formControlClassName(), 'mt-2')}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {scenarios.map((scenario) => (
          <option disabled={scenario.id === otherSelectedId} key={scenario.id} value={scenario.id}>
            {scenario.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function CompareStateCallout({
  message,
  title,
  tone,
}: {
  message: string;
  title: string;
  tone: 'error' | 'neutral' | 'success' | 'warning';
}) {
  return (
    <div
      className={classNames(
        'mt-5 rounded-xl border p-4 text-sm leading-6',
        tone === 'neutral' &&
          'border-dashed border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400',
        tone === 'warning' &&
          'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100',
        tone === 'success' &&
          'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200',
        tone === 'error' &&
          'border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200',
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <p
        className={classNames(
          'font-semibold',
          tone === 'neutral' && 'text-slate-800 dark:text-slate-200',
          tone === 'warning' && 'text-amber-950 dark:text-amber-100',
          tone === 'success' && 'text-emerald-900 dark:text-emerald-100',
          tone === 'error' && 'text-red-900 dark:text-red-100',
        )}
      >
        {title}
      </p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function SummaryComparison({
  comparedScenarios,
  displayUnit,
}: {
  comparedScenarios: readonly ComparedScenario[];
  displayUnit: DisplayUnit;
}) {
  return (
    <section aria-labelledby="compare-summary-heading" className="mt-6 min-w-0">
      <h3 className={sectionHeadingClassName} id="compare-summary-heading">
        Scenario summaries
      </h3>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {comparedScenarios.map((entry) => (
          <article
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/50"
            key={entry.saved.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h4 className="break-words font-semibold text-slate-950 dark:text-slate-50">{entry.saved.name}</h4>
              <p className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                {entry.saved.scenario.startYear}-{entry.saved.plan.endYear}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {buildSummaryCards(entry, displayUnit).map((card) => (
                <div
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none"
                  key={card.title}
                >
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{card.title}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950 dark:text-slate-50">{card.value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{card.detail}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HeadlineMetricsComparison({
  comparedScenarios,
  displayUnit,
}: {
  comparedScenarios: readonly ComparedScenario[];
  displayUnit: DisplayUnit;
}) {
  const metricsByScenario = comparedScenarios.map((entry) => ({
    entry,
    metrics: buildHeadlineMetrics(entry),
  }));

  return (
    <section aria-labelledby="compare-headline-metrics-heading" className="mt-6 min-w-0">
      <h3 className={sectionHeadingClassName} id="compare-headline-metrics-heading">
        Headline metrics
      </h3>
      <p className={classNames('mt-1', mutedTextClassName)}>
        Bridge-period metrics use the saved projection rows for each scenario. Scroll sideways on smaller screens.
      </p>
      <div className={tableShellClassName}>
        <table className={classNames(tableClassName, 'min-w-[760px]')}>
          <thead className={tableHeadClassName}>
            <tr>
              <th className={classNames(tableHeaderCellClassName, 'text-left')}>Metric</th>
              {metricsByScenario.map(({ entry }) => (
                <th className={classNames(tableHeaderCellClassName, 'text-right')} key={entry.saved.id}>
                  {entry.saved.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            <tr>
              <th className={classNames(tableCellClassName, 'text-left font-medium text-slate-700 dark:text-slate-200')} scope="row">
                Total bridge tax
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className={classNames(tableCellClassName, 'text-right tabular-nums')} key={entry.saved.id}>
                  {formatNullableMoney(
                    displayUnit === 'real'
                      ? computeTotalDisplayAmount(metrics.bridgeYears, entry, (breakdown) => breakdown.totalTax)
                      : metrics.totalBridgeTax,
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th className={classNames(tableCellClassName, 'text-left font-medium text-slate-700 dark:text-slate-200')} scope="row">
                Average bridge MAGI
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className={classNames(tableCellClassName, 'text-right tabular-nums')} key={entry.saved.id}>
                  {formatNullableMoney(
                    displayUnit === 'real'
                      ? computeAverageDisplayAmount(metrics.bridgeYears, entry, (breakdown) => breakdown.acaMagi)
                      : metrics.averageBridgeMagi,
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th className={classNames(tableCellClassName, 'text-left font-medium text-slate-700 dark:text-slate-200')} scope="row">
                Max withdrawal rate
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className={classNames(tableCellClassName, 'text-right')} key={entry.saved.id}>
                  <MetricCell
                    bandType="wdRate"
                    className="rounded px-1"
                    displayText={formatNullablePercentage(metrics.maxWithdrawalRate)}
                    label="Max withdrawal rate"
                    rawNumeric={metrics.maxWithdrawalRate}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <th className={classNames(tableCellClassName, 'text-left font-medium text-slate-700 dark:text-slate-200')} scope="row">
                Years above 400% FPL cliff
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className={classNames(tableCellClassName, 'text-right')} key={entry.saved.id}>
                  <MetricCell
                    bandType="fpl"
                    className="rounded px-1"
                    displayText={formatYears(metrics.cliffYearCount)}
                    label="ACA cliff years"
                    rawNumeric={metrics.cliffYearCount > 0 ? 4.01 : null}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <th className={classNames(tableCellClassName, 'text-left font-medium text-slate-700 dark:text-slate-200')} scope="row">
                Years touching IRMAA
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className={classNames(tableCellClassName, 'text-right tabular-nums')} key={entry.saved.id}>
                  {formatYears(metrics.irmaaTouchedYearCount)}
                </td>
              ))}
            </tr>
            <tr>
              <th className={classNames(tableCellClassName, 'text-left font-medium text-slate-700 dark:text-slate-200')} scope="row">
                Brokerage basis remaining at retirement
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className={classNames(tableCellClassName, 'text-right tabular-nums')} key={entry.saved.id}>
                  {metrics.brokerageBasisAtRetirement === null
                    ? '-'
                    : formatMoney(metrics.brokerageBasisAtRetirement.amount, metrics.brokerageBasisAtRetirement.year, entry, displayUnit)}
                </td>
              ))}
            </tr>
            <tr>
              <th className={classNames(tableCellClassName, 'text-left font-medium text-slate-700 dark:text-slate-200')} scope="row">
                Ending account mix
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className={classNames(tableCellClassName, 'text-right')} key={entry.saved.id}>
                  <EndingAccountMix entry={entry} shares={metrics.endingAccountMix} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EndingAccountMix({ entry, shares }: { entry: ComparedScenario; shares: readonly AccountMixShare[] }) {
  const hasPositiveMix = shares.some((share) => share.percentage > 0);

  return (
    <div
      aria-label={`Ending account mix for ${entry.saved.name}`}
      className="ml-auto max-w-72"
      data-testid={`ending-account-mix-${entry.saved.id}`}
    >
      {hasPositiveMix ? (
        <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="presentation">
          {shares.map((share) => {
            const colorClassName = ACCOUNT_MIX_KEYS.find((candidate) => candidate.key === share.key)?.colorClassName ?? 'bg-slate-300';

            return (
              <span
                aria-hidden="true"
                className={colorClassName}
                key={share.key}
                style={{ width: `${share.percentage}%` }}
              />
            );
          })}
        </div>
      ) : null}
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[0.7rem] leading-snug text-slate-600 dark:text-slate-400">
        {shares.map((share) => (
          <span data-account-share={share.key} data-share-value={share.percentage} key={share.key}>
            {share.label} {share.percentage}%
          </span>
        ))}
      </div>
    </div>
  );
}

function CombinedYearTable({
  comparedScenarios,
  displayUnit,
}: {
  comparedScenarios: readonly ComparedScenario[];
  displayUnit: DisplayUnit;
}) {
  const years = allProjectionYears(comparedScenarios);

  return (
    <section aria-labelledby="compare-year-table-heading" className="mt-6 min-w-0">
      <h3 className={sectionHeadingClassName} id="compare-year-table-heading">
        Combined year-by-year data
      </h3>
      <p className={classNames('mt-1', mutedTextClassName)}>
        A compact year grid for income, total tax plus premiums/credits, and ending balances.
      </p>
      <div className={tableShellClassName}>
        <table className={classNames(tableClassName, 'min-w-[900px]')}>
          <thead className={tableHeadClassName}>
            <tr>
              <th className={classNames(tableHeaderCellClassName, 'sticky left-0 z-10 bg-slate-100 text-right dark:bg-slate-900')}>
                Year
              </th>
              {comparedScenarios.map((entry) => (
                <th className={classNames(tableHeaderCellClassName, 'text-center')} colSpan={3} key={entry.saved.id}>
                  {entry.saved.name}
                </th>
              ))}
            </tr>
            <tr>
              <th className={classNames(tableHeaderCellClassName, 'sticky left-0 z-10 bg-slate-100 text-right dark:bg-slate-900')}>
                <span className="sr-only">Year metrics</span>
              </th>
              {comparedScenarios.map((entry) => (
                <RowHeaders key={entry.saved.id} />
              ))}
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {years.map((year) => (
              <tr key={year}>
                <th
                  className={classNames(
                    tableCellClassName,
                    'sticky left-0 z-10 bg-white text-right font-medium tabular-nums text-slate-800 dark:bg-slate-950 dark:text-slate-100',
                  )}
                  scope="row"
                >
                  {year}
                </th>
                {comparedScenarios.map((entry) => (
                  <YearCells displayUnit={displayUnit} entry={entry} key={entry.saved.id} year={year} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MagiOverlay({
  comparedScenarios,
  firstMagiVariant,
  onFirstMagiVariantChange,
  onSecondMagiVariantChange,
  palette,
  secondMagiVariant,
}: {
  comparedScenarios: readonly ComparedScenario[];
  firstMagiVariant: MagiVariant;
  onFirstMagiVariantChange: (variant: MagiVariant) => void;
  onSecondMagiVariantChange: (variant: MagiVariant) => void;
  palette: ChartPalette;
  secondMagiVariant: MagiVariant;
}) {
  const [first, second] = comparedScenarios;

  if (first === undefined || second === undefined) {
    return null;
  }

  const chartData = buildMagiOverlayData(first, second, firstMagiVariant, secondMagiVariant);

  return (
    <section aria-labelledby="compare-magi-heading" className="mt-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h3 className={sectionHeadingClassName} id="compare-magi-heading">
            MAGI overlay
          </h3>
          <p className={classNames('mt-1', mutedTextClassName)}>
            One selected MAGI series per scenario keeps the overlay readable while preserving ACA versus IRMAA context.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <MagiVariantSelect entry={first} onChange={onFirstMagiVariantChange} value={firstMagiVariant} />
          <MagiVariantSelect entry={second} onChange={onSecondMagiVariantChange} value={secondMagiVariant} />
        </div>
      </div>
      <div
        aria-label="Two-scenario MAGI overlay"
        className="mt-3 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 [contain:paint] dark:border-slate-800 dark:bg-slate-950 dark:shadow-none"
        role="img"
      >
        <div className="h-72 min-w-[40rem] p-3">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={chartData} margin={{ bottom: 4, left: 4, right: 28, top: 12 }}>
              <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
              <XAxis axisLine={false} dataKey="year" tick={{ fill: palette.axis, fontSize: 12 }} tickLine={false} />
              <YAxis
                axisLine={false}
                tick={{ fill: palette.axis, fontSize: 12 }}
                tickFormatter={formatCompactDollarTick}
                tickLine={false}
                width={72}
              />
              <Tooltip content={<CompareMagiTooltip palette={palette} />} />
              <Legend
                formatter={(value) => <span style={{ color: palette.legend }}>{String(value)}</span>}
                wrapperStyle={{ color: palette.legend, fontSize: 12 }}
              />
              <Line
                dataKey="firstMagi"
                dot={false}
                isAnimationActive={false}
                name={`${first.saved.name} ${MAGI_LABELS[firstMagiVariant]}`}
                stroke={palette.series.magi.acaMagi.stroke}
                strokeWidth={2}
                type="linear"
              />
              <Line
                dataKey="secondMagi"
                dot={false}
                isAnimationActive={false}
                name={`${second.saved.name} ${MAGI_LABELS[secondMagiVariant]}`}
                stroke={palette.series.magi.irmaaMagi.stroke}
                strokeWidth={2}
                type="linear"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function MagiVariantSelect({
  entry,
  onChange,
  value,
}: {
  entry: ComparedScenario;
  onChange: (variant: MagiVariant) => void;
  value: MagiVariant;
}) {
  const legendId = `magi-variant-${entry.saved.id}`;

  return (
    <div aria-labelledby={legendId} className="min-w-0" role="group">
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400" id={legendId}>
        MAGI series for {entry.saved.name}
      </p>
      <div className="mt-1 flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900/70">
        {(['acaMagi', 'irmaaMagi'] as const).map((variant) => {
          const selected = value === variant;

          return (
            <button
              aria-pressed={selected}
              className={classNames(
                'flex-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:focus-visible:outline-indigo-400',
                selected
                  ? 'border-slate-950 bg-slate-950 text-white shadow-sm shadow-slate-900/10 dark:border-indigo-400 dark:bg-indigo-400 dark:text-slate-950 dark:shadow-none'
                  : 'border-transparent text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-950 dark:hover:text-slate-50',
              )}
              key={variant}
              onClick={() => onChange(variant)}
              type="button"
            >
              {MAGI_LABELS[variant]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompareMagiTooltip({
  active,
  label,
  palette,
  payload,
}: {
  active?: boolean;
  label?: number | string;
  palette: ChartPalette;
  payload?: readonly TooltipPayloadItem[];
}) {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-lg p-3 text-sm shadow-lg shadow-slate-950/10"
      style={{
        backgroundColor: palette.tooltip.background,
        border: `1px solid ${palette.tooltip.border}`,
        color: palette.tooltip.text,
      }}
    >
      <p className="font-medium">{label}</p>
      <dl className="mt-2 grid gap-y-1">
        {payload
          .filter((item) => typeof item.value === 'number' && Number.isFinite(item.value))
          .map((item) => (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4" key={String(item.dataKey)}>
              <dt className="min-w-0 truncate" style={{ color: palette.tooltip.mutedText }}>
                {item.name ?? item.dataKey}
              </dt>
              <dd className="font-medium tabular-nums">{DOLLAR_FORMATTER.format(numberValue(item.value))}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

function TaxBreakdownComparison({
  comparedScenarios,
  displayUnit,
}: {
  comparedScenarios: readonly ComparedScenario[];
  displayUnit: DisplayUnit;
}) {
  return (
    <section aria-labelledby="compare-tax-heading" className="mt-6 min-w-0">
      <h3 className={sectionHeadingClassName} id="compare-tax-heading">
        Tax breakdown comparison
      </h3>
      <p className={classNames('mt-1', mutedTextClassName)}>
        Totals are summed from each saved projection. ACA premium credit is shown as a negative amount.
      </p>
      <div className={tableShellClassName}>
        <table className={classNames(tableClassName, 'min-w-[680px]')}>
          <thead className={tableHeadClassName}>
            <tr>
              <th className={classNames(tableHeaderCellClassName, 'text-left')}>Component</th>
              {comparedScenarios.map((entry) => (
                <th className={classNames(tableHeaderCellClassName, 'text-right')} key={entry.saved.id}>
                  {entry.saved.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {TAX_COMPONENTS.map((component) => (
              <tr key={component.key}>
                <th className={classNames(tableCellClassName, 'text-left font-medium text-slate-700 dark:text-slate-200')} scope="row">
                  {component.label}
                </th>
                {comparedScenarios.map((entry) => (
                  <td className={classNames(tableCellClassName, 'text-right tabular-nums')} key={entry.saved.id}>
                    {formatMoney(taxComponentTotal(entry, component.key, displayUnit), entry.saved.scenario.startYear, entry, 'nominal')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Credits reduce the total tax burden; premiums and taxes increase it.
      </p>
    </section>
  );
}

function RowHeaders() {
  return (
    <>
      <th className={classNames(tableHeaderCellClassName, 'text-right')}>AGI</th>
      <th className={classNames(tableHeaderCellClassName, 'text-right')}>Total tax</th>
      <th className={classNames(tableHeaderCellClassName, 'text-right')}>Ending balance</th>
    </>
  );
}

function YearCells({ displayUnit, entry, year }: { displayUnit: DisplayUnit; entry: ComparedScenario; year: number }) {
  const breakdown = entry.results.find((candidate) => candidate.year === year);

  if (breakdown === undefined) {
    return (
      <>
        <td className={classNames(tableCellClassName, 'text-right text-slate-400 dark:text-slate-500')}>-</td>
        <td className={classNames(tableCellClassName, 'text-right text-slate-400 dark:text-slate-500')}>-</td>
        <td className={classNames(tableCellClassName, 'text-right text-slate-400 dark:text-slate-500')}>-</td>
      </>
    );
  }

  return (
    <>
      <td className={classNames(tableCellClassName, 'text-right tabular-nums')}>
        {formatMoney(breakdown.agi, breakdown.year, entry, displayUnit)}
      </td>
      <td className={classNames(tableCellClassName, 'text-right tabular-nums')}>
        {formatMoney(taxAndPremiumAmount(breakdown), breakdown.year, entry, displayUnit)}
      </td>
      <td className={classNames(tableCellClassName, 'text-right tabular-nums')}>
        {formatMoney(sumBalances(breakdown.closingBalances), breakdown.year, entry, displayUnit)}
      </td>
    </>
  );
}

function buildComparedScenarios(
  firstScenario: SavedScenario | undefined,
  secondScenario: SavedScenario | undefined,
): CompareBuildResult {
  if (firstScenario === undefined || secondScenario === undefined || firstScenario.id === secondScenario.id) {
    return {
      kind: 'incomplete',
      message: 'Select two different saved scenarios from the local scenario library.',
      title: 'Choose two different scenarios',
    };
  }

  if (firstScenario.plan === undefined || secondScenario.plan === undefined) {
    return {
      kind: 'incomplete',
      message: 'Both selected scenarios need saved withdrawal plans. Update or resave the missing snapshot before comparing.',
      title: 'Saved plans are required',
    };
  }

  try {
    return {
      comparedScenarios: [
        {
          saved: { ...firstScenario, plan: firstScenario.plan },
          results: runProjection(firstScenario.scenario, firstScenario.plan),
        },
        {
          saved: { ...secondScenario, plan: secondScenario.plan },
          results: runProjection(secondScenario.scenario, secondScenario.plan),
        },
      ],
      kind: 'ready',
    };
  } catch {
    return {
      kind: 'error',
      message: 'One selected snapshot could not be projected. Review the saved inputs or update the snapshot from the active scenario.',
      title: 'Comparison could not be projected',
    };
  }
}

function buildSummaryCards(entry: ComparedScenario, displayUnit: DisplayUnit): readonly SummaryCard[] {
  const firstBreakdown = entry.results[0] ?? null;
  const finalBreakdown = entry.results.at(-1) ?? null;
  const yearsFunded = computeYearsFunded(entry.results);

  return [
    {
      title: 'Starting balance',
      value: formatMoney(
        firstBreakdown === null ? 0 : sumBalances(firstBreakdown.openingBalances),
        firstBreakdown?.year ?? entry.saved.scenario.startYear,
        entry,
        displayUnit,
      ),
      detail: firstBreakdown === null ? 'No projection years.' : `Opening supported balances in ${firstBreakdown.year}.`,
    },
    {
      title: 'Plan-end balance',
      value: formatMoney(
        finalBreakdown === null ? 0 : sumBalances(finalBreakdown.closingBalances),
        finalBreakdown?.year ?? entry.saved.scenario.startYear,
        entry,
        displayUnit,
      ),
      detail: finalBreakdown === null ? 'No final year.' : `Closing balance in ${finalBreakdown.year}.`,
    },
    {
      title: 'Years funded',
      value: `${yearsFunded.count} ${yearsFunded.count === 1 ? 'year' : 'years'}`,
      detail:
        yearsFunded.depletedYear === null
          ? `Fully funded through ${entry.saved.plan.endYear}.`
          : `Supported balances hit zero in ${yearsFunded.depletedYear}.`,
    },
  ];
}

function buildHeadlineMetrics(entry: ComparedScenario): HeadlineMetrics {
  const bridgeYears = selectComparableBridgeYears(entry);
  const retirementYear = inferRetirementYear(entry);
  const retirementBreakdown = entry.results.find((breakdown) => breakdown.year === retirementYear) ?? null;

  return {
    averageBridgeMagi: computeAverageBridgeAcaMagi(bridgeYears),
    bridgeYears,
    brokerageBasisAtRetirement:
      retirementBreakdown === null
        ? null
        : {
            amount: retirementBreakdown.brokerageBasis.opening,
            year: retirementBreakdown.year,
          },
    cliffYearCount: computeBridgeAcaCliffYearCount(bridgeYears, entry.saved.scenario),
    endingAccountMix: computeEndingAccountMix(entry.results.at(-1)?.closingBalances ?? null),
    irmaaTouchedYearCount: computeBridgeIrmaaTouchedYearCount(bridgeYears),
    maxWithdrawalRate: computeMaxBridgeGrossBucketDrawPercentage(bridgeYears),
    totalBridgeTax: computeTotalBridgeTax(bridgeYears),
  };
}

function selectComparableBridgeYears(entry: ComparedScenario): readonly YearBreakdown[] {
  const retirementYear = inferRetirementYear(entry);
  const bridgeEndYear = inferBridgeEndYear(entry.saved.scenario, retirementYear);

  return entry.results.filter((breakdown) => breakdown.year >= retirementYear && breakdown.year <= bridgeEndYear);
}

function inferRetirementYear(entry: ComparedScenario): number {
  const configuredRetirementYear = entry.saved.scenario.autoDepleteBrokerage?.retirementYear;
  if (typeof configuredRetirementYear === 'number' && Number.isFinite(configuredRetirementYear)) {
    return Math.trunc(configuredRetirementYear);
  }

  const years = entry.results.map((breakdown) => breakdown.year);
  const inferredFromEarnedIncome = years.find((year, index) => {
    if (earnedIncomeForYear(entry.saved.scenario, year) > 0) {
      return false;
    }

    const hadPriorEarnedIncome = years.slice(0, index).some((priorYear) => earnedIncomeForYear(entry.saved.scenario, priorYear) > 0);
    const laterYearsStayRetired = years.slice(index).every((candidateYear) => earnedIncomeForYear(entry.saved.scenario, candidateYear) <= 0);

    return hadPriorEarnedIncome && laterYearsStayRetired;
  });

  return inferredFromEarnedIncome ?? entry.saved.scenario.startYear;
}

function inferBridgeEndYear(scenario: Scenario, retirementYear: number): number {
  const medicareYear =
    scenario.healthcare
      .filter((phase) => phase.kind === 'medicare' && phase.year > retirementYear)
      .map((phase) => phase.year)
      .sort((left, right) => left - right)[0] ?? null;

  if (medicareYear !== null) {
    return medicareYear - 1;
  }

  if (
    scenario.socialSecurity !== undefined &&
    scenario.socialSecurity.annualBenefit > 0 &&
    scenario.socialSecurity.claimYear > retirementYear
  ) {
    return scenario.socialSecurity.claimYear - 1;
  }

  return retirementYear + 9;
}

function earnedIncomeForYear(scenario: Scenario, year: number): number {
  return sumAnnualAmounts(scenario.w2Income, year) + sumAnnualAmounts(scenario.consultingIncome, year);
}

function computeEndingAccountMix(balances: AccountBalances | null): readonly AccountMixShare[] {
  const endingBalances = balances ?? {
    cash: 0,
    hsa: 0,
    taxableBrokerage: 0,
    traditional: 0,
    roth: 0,
  };
  const total = ACCOUNT_MIX_KEYS.reduce((sum, account) => sum + endingBalances[account.key], 0);
  const rawPercentages = ACCOUNT_MIX_KEYS.map((account) => (total <= 0 ? 0 : (endingBalances[account.key] / total) * 100));
  const percentages = roundPercentagesToHundred(rawPercentages);

  return ACCOUNT_MIX_KEYS.map((account, index) => ({
    key: account.key,
    label: account.label,
    percentage: percentages[index] ?? 0,
  }));
}

function roundPercentagesToHundred(rawPercentages: readonly number[]): readonly number[] {
  if (rawPercentages.every((percentage) => percentage <= 0)) {
    return rawPercentages.map(() => 0);
  }

  const floors = rawPercentages.map((percentage) => Math.floor(percentage));
  const remaining = 100 - floors.reduce((total, percentage) => total + percentage, 0);
  const rankedFractions = rawPercentages
    .map((percentage, index) => ({ fraction: percentage - Math.floor(percentage), index }))
    .sort((left, right) => right.fraction - left.fraction);

  return floors.map((percentage, index) => {
    const extraPoint = rankedFractions.slice(0, remaining).some((fraction) => fraction.index === index) ? 1 : 0;

    return percentage + extraPoint;
  });
}

function allProjectionYears(comparedScenarios: readonly ComparedScenario[]): readonly number[] {
  return Array.from(new Set(comparedScenarios.flatMap((entry) => entry.results.map((breakdown) => breakdown.year)))).sort(
    (left, right) => left - right,
  );
}

function buildMagiOverlayData(
  first: ComparedScenario,
  second: ComparedScenario,
  firstVariant: MagiVariant,
  secondVariant: MagiVariant,
): readonly Readonly<{ firstMagi: number | null; secondMagi: number | null; year: number }>[] {
  return allProjectionYears([first, second]).map((year) => ({
    firstMagi: first.results.find((breakdown) => breakdown.year === year)?.[firstVariant] ?? null,
    secondMagi: second.results.find((breakdown) => breakdown.year === year)?.[secondVariant] ?? null,
    year,
  }));
}

function computeYearsFunded(projectionResults: readonly YearBreakdown[]): { count: number; depletedYear: number | null } {
  const depletionIndex = projectionResults.findIndex(
    (breakdown) => sumBalances(breakdown.closingBalances) <= 0,
  );

  if (depletionIndex === -1) {
    return {
      count: projectionResults.length,
      depletedYear: null,
    };
  }

  return {
    count: depletionIndex + 1,
    depletedYear: projectionResults[depletionIndex]?.year ?? null,
  };
}

function taxComponentTotal(entry: ComparedScenario, component: TaxComponentKey, displayUnit: DisplayUnit): number {
  return entry.results.reduce(
    (total, breakdown) => total + displayAmount(taxComponentAmount(breakdown, component), breakdown.year, entry, displayUnit),
    0,
  );
}

function taxComponentAmount(breakdown: YearBreakdown, component: TaxComponentKey): number {
  switch (component) {
    case 'federalTax':
      return breakdown.federalTax;
    case 'stateTax':
      return breakdown.stateTax;
    case 'ltcgTax':
      return breakdown.ltcgTax;
    case 'niit':
      return breakdown.niit;
    case 'seTax':
      return breakdown.seTax;
    case 'irmaaPremium':
      return breakdown.irmaaPremium?.annualIrmaaSurcharge ?? 0;
    case 'acaPremiumCredit':
      return -(breakdown.aptcReconciliation?.netPremiumTaxCredit ?? breakdown.acaPremiumCredit?.premiumTaxCredit ?? 0);
  }
}

function taxAndPremiumAmount(breakdown: YearBreakdown): number {
  return breakdown.totalTax + (breakdown.irmaaPremium?.annualIrmaaSurcharge ?? 0) + taxComponentAmount(breakdown, 'acaPremiumCredit');
}

function computeAverageDisplayAmount(
  years: readonly YearBreakdown[],
  entry: ComparedScenario,
  getAmount: (breakdown: YearBreakdown) => number,
): number | null {
  if (years.length === 0) {
    return null;
  }

  const total = computeTotalDisplayAmount(years, entry, getAmount);

  return total === null ? null : total / years.length;
}

function computeTotalDisplayAmount(
  years: readonly YearBreakdown[],
  entry: ComparedScenario,
  getAmount: (breakdown: YearBreakdown) => number,
): number | null {
  if (years.length === 0) {
    return null;
  }

  return years.reduce((total, breakdown) => total + displayAmount(getAmount(breakdown), breakdown.year, entry, 'real'), 0);
}

function formatMoney(amount: number, year: number, entry: ComparedScenario, displayUnit: DisplayUnit): string {
  return DOLLAR_FORMATTER.format(displayAmount(amount, year, entry, displayUnit));
}

function formatNullableMoney(amount: number | null): string {
  return amount === null ? '-' : DOLLAR_FORMATTER.format(amount);
}

function formatNullablePercentage(amount: number | null): string {
  return amount === null ? '-' : PERCENT_FORMATTER.format(amount);
}

function formatYears(years: number): string {
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

function displayAmount(amount: number, year: number, entry: ComparedScenario, displayUnit: DisplayUnit): number {
  return displayUnit === 'real'
    ? toReal(amount, year, entry.saved.scenario.startYear, entry.saved.scenario.inflationRate)
    : amount;
}

function sumAnnualAmounts(entries: readonly { year: number; amount: number }[], year: number): number {
  return entries.reduce((total, entry) => total + (entry.year === year ? entry.amount : 0), 0);
}

function sumBalances(balances: AccountBalances): number {
  return BALANCE_KEYS.reduce((total, key) => total + balances[key], 0);
}

function formatCompactDollarTick(value: number | string): string {
  const amount = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(amount)) {
    return '$0';
  }

  const absoluteAmount = Math.abs(amount);
  const prefix = amount < 0 ? '-$' : '$';

  if (absoluteAmount >= 1_000_000) {
    return `${prefix}${(absoluteAmount / 1_000_000).toFixed(1)}M`;
  }

  if (absoluteAmount >= 1_000) {
    return `${prefix}${(absoluteAmount / 1_000).toFixed(1)}k`;
  }

  return DOLLAR_FORMATTER.format(amount);
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
