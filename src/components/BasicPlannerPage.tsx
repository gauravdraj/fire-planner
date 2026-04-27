import { BalancesChart } from '@/components/BalancesChart';
import { BasicForm } from '@/components/BasicForm';
import { MagiChart } from '@/components/charts/MagiChart';
import { TaxBreakdownChart } from '@/components/charts/TaxBreakdownChart';
import { SummaryCards } from '@/components/SummaryCards';
import { YearByYearTable } from '@/components/YearByYearTable';
import { useScenarioStore } from '@/store/scenarioStore';

export function BasicPlannerPage() {
  const hasRunProjection = useScenarioStore((state) => state.hasRunProjection);

  return (
    <section aria-labelledby="basic-planner-heading" className="rounded-lg border border-slate-200 p-5">
      <h2 className="text-xl font-semibold" id="basic-planner-heading">
        Basic planner
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Enter the household facts the current engine supports, then run the projection.
      </p>
      <BasicForm />
      {hasRunProjection ? <ProjectionResults /> : <ProjectionEmptyState />}
    </section>
  );
}

function ProjectionResults() {
  return (
    <>
      <SummaryCards />
      <YearByYearTable />
      <BalancesChart />
      <MagiChart />
      <TaxBreakdownChart />
    </>
  );
}

function ProjectionEmptyState() {
  return (
    <section
      aria-label="Projection results"
      className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600"
    >
      <p className="font-medium text-slate-800">Projection results will appear here after you run the scenario.</p>
      <p className="mt-1">Run the projection to see summary cards, a year-by-year table, and account balances.</p>
    </section>
  );
}
