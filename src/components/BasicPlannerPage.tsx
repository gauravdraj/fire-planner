import { BalancesChart } from '@/components/BalancesChart';
import { BasicForm } from '@/components/BasicForm';
import { MagiChart } from '@/components/charts/MagiChart';
import { LiveStatsStrip } from '@/components/LiveStatsStrip';
import { SeventyTwoTCalc } from '@/components/SeventyTwoTCalc';
import { TaxBreakdownChart } from '@/components/charts/TaxBreakdownChart';
import { WhyChangedCallout } from '@/components/WhyChangedCallout';
import { YearByYearTable } from '@/components/YearByYearTable';

export function BasicPlannerPage() {
  return (
    <section aria-labelledby="basic-planner-heading" className="rounded-lg border border-slate-200 p-5">
      <h2 className="text-xl font-semibold" id="basic-planner-heading">
        Basic planner
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Enter the household facts the current engine supports, and the projection updates as you edit.
      </p>
      <BasicForm />
      <ProjectionResults />
      <section aria-labelledby="seventy-two-t-heading" className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-lg font-semibold text-slate-950" id="seventy-two-t-heading">
          72(t) SEPP IRA size calculator
        </h3>
        <p className="mt-1 text-sm text-slate-600">Fixed Amortization Method. Independent of your scenario above.</p>
        <SeventyTwoTCalc />
      </section>
    </section>
  );
}

function ProjectionResults() {
  return (
    <>
      <LiveStatsStrip />
      <WhyChangedCallout />
      <YearByYearTable />
      <BalancesChart />
      <MagiChart />
      <TaxBreakdownChart />
    </>
  );
}
