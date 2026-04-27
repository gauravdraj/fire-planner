export const DISCLAIMER_TEXT =
  'Educational estimate only. Not tax, legal, investment, or filing advice. Do not make tax elections (Roth conversions, withdrawals, harvesting) from this output without verifying official IRS/state sources or a qualified professional.';

export function Disclaimer() {
  return (
    <section className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p className="mx-auto max-w-5xl">{DISCLAIMER_TEXT}</p>
    </section>
  );
}
