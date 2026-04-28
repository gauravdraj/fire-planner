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

import { runProjection, type AccountBalances, type Scenario, type WithdrawalPlan, type YearBreakdown } from '@/core/projection';
import { toReal } from '@/lib/realDollars';
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
  const comparedScenarios = useMemo(
    () => buildComparedScenarios(firstScenario, secondScenario),
    [firstScenario, secondScenario],
  );
  const unitLabel = displayUnit === 'real' ? "today's dollars" : 'nominal dollars';

  return (
    <section aria-labelledby="compare-view-heading" className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold" id="compare-view-heading">
            Compare two scenarios
          </h3>
          <p className="text-sm text-slate-600">
            Pick exactly two saved local scenarios to compare summaries, annual results, MAGI, and taxes.
          </p>
        </div>
        <p className="text-xs text-slate-500">{unitLabel}</p>
      </div>

      {scenarios.length < 2 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          Save at least two scenarios before comparing.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
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

          {comparedScenarios.length !== 2 ? (
            <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              Select two different scenarios that both have saved withdrawal plans.
            </p>
          ) : (
            <>
              <SummaryComparison comparedScenarios={comparedScenarios} displayUnit={displayUnit} />
              <HeadlineMetricsComparison comparedScenarios={comparedScenarios} displayUnit={displayUnit} />
              <CombinedYearTable comparedScenarios={comparedScenarios} displayUnit={displayUnit} />
              <MagiOverlay
                comparedScenarios={comparedScenarios}
                firstMagiVariant={firstMagiVariant}
                onFirstMagiVariantChange={setFirstMagiVariant}
                onSecondMagiVariantChange={setSecondMagiVariant}
                secondMagiVariant={secondMagiVariant}
              />
              <TaxBreakdownComparison comparedScenarios={comparedScenarios} displayUnit={displayUnit} />
            </>
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
      <label className="text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <select
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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

function SummaryComparison({
  comparedScenarios,
  displayUnit,
}: {
  comparedScenarios: readonly ComparedScenario[];
  displayUnit: DisplayUnit;
}) {
  return (
    <section aria-labelledby="compare-summary-heading" className="mt-6">
      <h4 className="text-base font-semibold" id="compare-summary-heading">
        Scenario summaries
      </h4>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {comparedScenarios.map((entry) => (
          <article className="rounded-lg border border-slate-200 p-4" key={entry.saved.id}>
            <h5 className="font-semibold text-slate-950">{entry.saved.name}</h5>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {buildSummaryCards(entry, displayUnit).map((card) => (
                <div className="rounded-lg bg-slate-50 p-3" key={card.title}>
                  <p className="text-xs font-medium text-slate-600">{card.title}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{card.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
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
    <section aria-labelledby="compare-headline-metrics-heading" className="mt-6">
      <h4 className="text-base font-semibold" id="compare-headline-metrics-heading">
        Headline metrics
      </h4>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Metric</th>
              {metricsByScenario.map(({ entry }) => (
                <th className="px-3 py-2 text-right font-medium" key={entry.saved.id}>
                  {entry.saved.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700" scope="row">
                Total bridge tax
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className="px-3 py-2 text-right tabular-nums" key={entry.saved.id}>
                  {formatNullableMoney(
                    displayUnit === 'real'
                      ? computeTotalDisplayAmount(metrics.bridgeYears, entry, (breakdown) => breakdown.totalTax)
                      : metrics.totalBridgeTax,
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700" scope="row">
                Average bridge MAGI
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className="px-3 py-2 text-right tabular-nums" key={entry.saved.id}>
                  {formatNullableMoney(
                    displayUnit === 'real'
                      ? computeAverageDisplayAmount(metrics.bridgeYears, entry, (breakdown) => breakdown.acaMagi)
                      : metrics.averageBridgeMagi,
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700" scope="row">
                Max withdrawal rate
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className="px-3 py-2 text-right" key={entry.saved.id}>
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
              <th className="px-3 py-2 text-left font-medium text-slate-700" scope="row">
                Years above 400% FPL cliff
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className="px-3 py-2 text-right" key={entry.saved.id}>
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
              <th className="px-3 py-2 text-left font-medium text-slate-700" scope="row">
                Years touching IRMAA
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className="px-3 py-2 text-right tabular-nums" key={entry.saved.id}>
                  {formatYears(metrics.irmaaTouchedYearCount)}
                </td>
              ))}
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700" scope="row">
                Brokerage basis remaining at retirement
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className="px-3 py-2 text-right tabular-nums" key={entry.saved.id}>
                  {metrics.brokerageBasisAtRetirement === null
                    ? '-'
                    : formatMoney(metrics.brokerageBasisAtRetirement.amount, metrics.brokerageBasisAtRetirement.year, entry, displayUnit)}
                </td>
              ))}
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700" scope="row">
                Ending account mix
              </th>
              {metricsByScenario.map(({ entry, metrics }) => (
                <td className="px-3 py-2 text-right" key={entry.saved.id}>
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
        <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" role="presentation">
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
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[0.7rem] leading-snug text-slate-600">
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
    <section aria-labelledby="compare-year-table-heading" className="mt-6">
      <h4 className="text-base font-semibold" id="compare-year-table-heading">
        Combined year-by-year data
      </h4>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-right font-medium">Year</th>
              {comparedScenarios.map((entry) => (
                <th className="px-3 py-2 text-center font-medium" colSpan={3} key={entry.saved.id}>
                  {entry.saved.name}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-right font-medium"> </th>
              {comparedScenarios.map((entry) => (
                <RowHeaders key={entry.saved.id} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {years.map((year) => (
              <tr key={year}>
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-right font-medium tabular-nums" scope="row">
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
  secondMagiVariant,
}: {
  comparedScenarios: readonly ComparedScenario[];
  firstMagiVariant: MagiVariant;
  onFirstMagiVariantChange: (variant: MagiVariant) => void;
  onSecondMagiVariantChange: (variant: MagiVariant) => void;
  secondMagiVariant: MagiVariant;
}) {
  const [first, second] = comparedScenarios;

  if (first === undefined || second === undefined) {
    return null;
  }

  const chartData = buildMagiOverlayData(first, second, firstMagiVariant, secondMagiVariant);

  return (
    <section aria-labelledby="compare-magi-heading" className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="text-base font-semibold" id="compare-magi-heading">
            MAGI overlay
          </h4>
          <p className="text-sm text-slate-600">One MAGI series per scenario keeps the overlay readable.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <MagiVariantSelect entry={first} onChange={onFirstMagiVariantChange} value={firstMagiVariant} />
          <MagiVariantSelect entry={second} onChange={onSecondMagiVariantChange} value={secondMagiVariant} />
        </div>
      </div>
      <div aria-label="Two-scenario MAGI overlay" className="mt-3 rounded-lg border border-slate-200" role="img">
        <div className="h-72 w-full p-3">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={chartData} margin={{ bottom: 4, left: 4, right: 28, top: 12 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis axisLine={false} dataKey="year" tick={{ fill: '#475569', fontSize: 12 }} tickLine={false} />
              <YAxis
                axisLine={false}
                tick={{ fill: '#475569', fontSize: 12 }}
                tickFormatter={formatCompactDollarTick}
                tickLine={false}
                width={72}
              />
              <Tooltip formatter={(value) => DOLLAR_FORMATTER.format(numberValue(value))} />
              <Legend formatter={(value) => String(value)} wrapperStyle={{ fontSize: 12 }} />
              <Line
                dataKey="firstMagi"
                dot={false}
                isAnimationActive={false}
                name={`${first.saved.name} ${MAGI_LABELS[firstMagiVariant]}`}
                stroke="#047857"
                strokeWidth={2}
                type="linear"
              />
              <Line
                dataKey="secondMagi"
                dot={false}
                isAnimationActive={false}
                name={`${second.saved.name} ${MAGI_LABELS[secondMagiVariant]}`}
                stroke="#7c3aed"
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
  const id = `magi-variant-${entry.saved.id}`;

  return (
    <div>
      <label className="text-xs font-medium text-slate-600" htmlFor={id}>
        MAGI series for {entry.saved.name}
      </label>
      <select
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        id={id}
        onChange={(event) => onChange(event.target.value as MagiVariant)}
        value={value}
      >
        <option value="acaMagi">{MAGI_LABELS.acaMagi}</option>
        <option value="irmaaMagi">{MAGI_LABELS.irmaaMagi}</option>
      </select>
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
    <section aria-labelledby="compare-tax-heading" className="mt-6">
      <h4 className="text-base font-semibold" id="compare-tax-heading">
        Tax breakdown comparison
      </h4>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[680px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Component</th>
              {comparedScenarios.map((entry) => (
                <th className="px-3 py-2 text-right font-medium" key={entry.saved.id}>
                  {entry.saved.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {TAX_COMPONENTS.map((component) => (
              <tr key={component.key}>
                <th className="px-3 py-2 text-left font-medium text-slate-700" scope="row">
                  {component.label}
                </th>
                {comparedScenarios.map((entry) => (
                  <td className="px-3 py-2 text-right tabular-nums" key={entry.saved.id}>
                    {formatMoney(taxComponentTotal(entry, component.key, displayUnit), entry.saved.scenario.startYear, entry, 'nominal')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">ACA premium credit is shown as a negative amount.</p>
    </section>
  );
}

function RowHeaders() {
  return (
    <>
      <th className="px-3 py-2 text-right font-medium">AGI</th>
      <th className="px-3 py-2 text-right font-medium">Total tax</th>
      <th className="px-3 py-2 text-right font-medium">Ending balance</th>
    </>
  );
}

function YearCells({ displayUnit, entry, year }: { displayUnit: DisplayUnit; entry: ComparedScenario; year: number }) {
  const breakdown = entry.results.find((candidate) => candidate.year === year);

  if (breakdown === undefined) {
    return (
      <>
        <td className="px-3 py-2 text-right text-slate-400">-</td>
        <td className="px-3 py-2 text-right text-slate-400">-</td>
        <td className="px-3 py-2 text-right text-slate-400">-</td>
      </>
    );
  }

  return (
    <>
      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(breakdown.agi, breakdown.year, entry, displayUnit)}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatMoney(taxAndPremiumAmount(breakdown), breakdown.year, entry, displayUnit)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatMoney(sumBalances(breakdown.closingBalances), breakdown.year, entry, displayUnit)}
      </td>
    </>
  );
}

function buildComparedScenarios(
  firstScenario: SavedScenario | undefined,
  secondScenario: SavedScenario | undefined,
): readonly ComparedScenario[] {
  if (
    firstScenario === undefined ||
    secondScenario === undefined ||
    firstScenario.id === secondScenario.id ||
    firstScenario.plan === undefined ||
    secondScenario.plan === undefined
  ) {
    return [];
  }

  return [
    {
      saved: { ...firstScenario, plan: firstScenario.plan },
      results: runProjection(firstScenario.scenario, firstScenario.plan),
    },
    {
      saved: { ...secondScenario, plan: secondScenario.plan },
      results: runProjection(secondScenario.scenario, secondScenario.plan),
    },
  ];
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
