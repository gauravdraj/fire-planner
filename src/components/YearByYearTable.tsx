import { CONSTANTS_2026 } from '@/core/constants/2026';
import type { AccountBalances, Scenario, YearBreakdown } from '@/core/projection';
import { toReal } from '@/lib/realDollars';
import { getStalenessLevel } from '@/lib/staleness';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

type YearByYearTableProps = {
  now?: Date | string;
};

type TableRow = Readonly<{
  year: number;
  age: number;
  totalWithdrawals: string;
  agi: string;
  totalTax: string;
  afterTaxCashFlow: string;
  endingBalance: string;
}>;

const BALANCE_KEYS = ['cash', 'taxableBrokerage', 'traditional', 'roth'] as const;

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function YearByYearTable({ now = new Date() }: YearByYearTableProps) {
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const scenario = useScenarioStore((state) => state.scenario);
  const currentYear = useScenarioStore((state) => state.formValues.currentYear);
  const primaryAge = useScenarioStore((state) => state.formValues.primaryAge);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const isStale = getStalenessLevel(CONSTANTS_2026.retrievedAt, now) !== 'fresh';
  const rows = buildTableRows({
    currentYear,
    displayUnit,
    primaryAge,
    projectionResults,
    scenario,
  });

  return (
    <section aria-labelledby="year-by-year-heading" className="mt-6">
      <h2 className="text-lg font-semibold" id="year-by-year-heading">
        Year-by-year projection
      </h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <ColumnHeader className="sticky left-0 z-10 bg-slate-50">Year</ColumnHeader>
              <ColumnHeader>Age</ColumnHeader>
              <ColumnHeader>Total withdrawals</ColumnHeader>
              <ColumnHeader>AGI</ColumnHeader>
              <ColumnHeader>Total tax</ColumnHeader>
              <ColumnHeader>After-tax cash flow</ColumnHeader>
              <ColumnHeader>Ending balance</ColumnHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row) => (
              <tr data-stale={isStale ? 'true' : undefined} key={row.year}>
                <RowHeader dataStale={isStale}>{row.year}</RowHeader>
                <MoneyCell dataStale={isStale}>{row.age}</MoneyCell>
                <MoneyCell dataStale={isStale}>{row.totalWithdrawals}</MoneyCell>
                <MoneyCell dataStale={isStale}>{row.agi}</MoneyCell>
                <MoneyCell dataStale={isStale}>{row.totalTax}</MoneyCell>
                <MoneyCell dataStale={isStale}>{row.afterTaxCashFlow}</MoneyCell>
                <MoneyCell dataStale={isStale}>{row.endingBalance}</MoneyCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildTableRows({
  currentYear,
  displayUnit,
  primaryAge,
  projectionResults,
  scenario,
}: {
  currentYear: number;
  displayUnit: DisplayUnit;
  primaryAge: number;
  projectionResults: readonly YearBreakdown[];
  scenario: Scenario;
}): readonly TableRow[] {
  return projectionResults.map((breakdown) => ({
    year: breakdown.year,
    age: primaryAge + (breakdown.year - currentYear),
    totalWithdrawals: formatMoney(sumBalances(breakdown.withdrawals), breakdown.year, scenario, displayUnit),
    agi: formatMoney(breakdown.agi, breakdown.year, scenario, displayUnit),
    totalTax: formatMoney(breakdown.totalTax, breakdown.year, scenario, displayUnit),
    afterTaxCashFlow: formatMoney(breakdown.afterTaxCashFlow, breakdown.year, scenario, displayUnit),
    endingBalance: formatMoney(sumBalances(breakdown.closingBalances), breakdown.year, scenario, displayUnit),
  }));
}

function formatMoney(amount: number, year: number, scenario: Scenario, displayUnit: DisplayUnit): string {
  const displayAmount =
    displayUnit === 'real' ? toReal(amount, year, scenario.startYear, scenario.inflationRate) : amount;

  return DOLLAR_FORMATTER.format(displayAmount);
}

function sumBalances(balances: AccountBalances): number {
  return BALANCE_KEYS.reduce((total, key) => total + balances[key], 0);
}

function ColumnHeader({ children, className = '' }: { children: string; className?: string }) {
  return <th className={`whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums ${className}`}>{children}</th>;
}

function RowHeader({ children, dataStale }: { children: number; dataStale: boolean }) {
  return (
    <th
      className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 text-right font-medium tabular-nums text-slate-950"
      data-stale={dataStale ? 'true' : undefined}
      scope="row"
    >
      {children}
    </th>
  );
}

function MoneyCell({ children, dataStale }: { children: number | string; dataStale: boolean }) {
  return (
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums" data-stale={dataStale ? 'true' : undefined}>
      {children}
    </td>
  );
}
