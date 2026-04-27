import { CONSTANTS_2026 } from '@/core/constants/2026';
import type { AccountBalances, Scenario, YearBreakdown } from '@/core/projection';
import { toReal } from '@/lib/realDollars';
import { getStalenessLevel } from '@/lib/staleness';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

type SummaryCardsProps = {
  now?: Date | string;
};

type SummaryCard = Readonly<{
  title: string;
  value: string;
  detail: string;
}>;

const SUPPORTED_BALANCE_KEYS = ['cash', 'taxableBrokerage', 'traditional', 'roth'] as const;

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function SummaryCards({ now = new Date() }: SummaryCardsProps) {
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const retirementYear = useScenarioStore((state) => state.formValues.retirementYear);
  const planEndAge = useScenarioStore((state) => state.formValues.planEndAge);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const isStale = getStalenessLevel(CONSTANTS_2026.retrievedAt, now) !== 'fresh';
  const unitLabel = displayUnit === 'real' ? "today's dollars" : 'nominal dollars';
  const cards = buildSummaryCards({
    displayUnit,
    planEndAge,
    projectionResults,
    retirementYear,
    scenario,
  });

  return (
    <section aria-labelledby="projection-summary-heading" className="mt-6">
      <h2 className="text-lg font-semibold" id="projection-summary-heading">
        Projection summary
      </h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {cards.map((card) => (
          <article
            aria-labelledby={summaryCardHeadingId(card.title)}
            className="rounded-lg border border-slate-200 bg-white p-4"
            key={card.title}
          >
            <h3 className="text-sm font-medium text-slate-600" id={summaryCardHeadingId(card.title)}>
              {card.title}
            </h3>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950" data-stale={isStale ? 'true' : undefined}>
              {card.value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{unitLabel}</p>
            <p className="mt-3 text-sm text-slate-600">{card.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function buildSummaryCards({
  displayUnit,
  planEndAge,
  projectionResults,
  retirementYear,
  scenario,
}: {
  displayUnit: DisplayUnit;
  planEndAge: number;
  projectionResults: readonly YearBreakdown[];
  retirementYear: number;
  scenario: Scenario;
}): readonly SummaryCard[] {
  const retirementBreakdown = projectionResults.find((breakdown) => breakdown.year >= retirementYear) ?? null;
  const finalBreakdown = projectionResults.at(-1) ?? null;
  const retirementBalance = retirementBreakdown === null ? 0 : sumSupportedBalances(retirementBreakdown.openingBalances);
  const finalBalance = finalBreakdown === null ? 0 : sumSupportedBalances(finalBreakdown.closingBalances);
  const yearsFunded = computeYearsFunded(projectionResults);

  return [
    {
      title: 'Net worth at retirement',
      value: formatBalance(retirementBalance, retirementBreakdown?.year ?? scenario.startYear, scenario, displayUnit),
      detail:
        retirementBreakdown === null
          ? 'No projection year is available.'
          : `Opening supported balances in ${retirementBreakdown.year}.`,
    },
    {
      title: 'Plan-end balance',
      value: formatBalance(finalBalance, finalBreakdown?.year ?? scenario.startYear, scenario, displayUnit),
      detail: finalBreakdown === null ? 'No final projection year is available.' : `Closing balance in ${finalBreakdown.year}.`,
    },
    {
      title: 'Years funded',
      value: formatYears(yearsFunded.count),
      detail:
        yearsFunded.depletedYear === null
          ? `Fully funded through plan-end age ${planEndAge}.`
          : `Supported balances hit zero in ${yearsFunded.depletedYear}.`,
    },
  ];
}

function computeYearsFunded(projectionResults: readonly YearBreakdown[]): { count: number; depletedYear: number | null } {
  const depletionIndex = projectionResults.findIndex(
    (breakdown) => sumSupportedBalances(breakdown.closingBalances) <= 0,
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

function formatBalance(amount: number, year: number, scenario: Scenario, displayUnit: DisplayUnit): string {
  const displayAmount =
    displayUnit === 'real' ? toReal(amount, year, scenario.startYear, scenario.inflationRate) : amount;

  return DOLLAR_FORMATTER.format(displayAmount);
}

function formatYears(years: number): string {
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

function sumSupportedBalances(balances: AccountBalances): number {
  return SUPPORTED_BALANCE_KEYS.reduce((total, key) => total + balances[key], 0);
}

function summaryCardHeadingId(title: string): string {
  return `summary-card-${title.toLowerCase().replaceAll(/\s+/g, '-')}`;
}
