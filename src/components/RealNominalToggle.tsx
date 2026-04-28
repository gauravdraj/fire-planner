import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

const DISPLAY_UNITS: ReadonlyArray<{ label: string; value: DisplayUnit }> = [
  { label: 'Real dollars', value: 'real' },
  { label: 'Nominal dollars', value: 'nominal' },
];

export function RealNominalToggle() {
  const displayUnit = useUiStore((state) => state.displayUnit);
  const setDisplayUnit = useUiStore((state) => state.setDisplayUnit);

  return (
    <div
      aria-label="Display dollars"
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-300 bg-white p-1 shadow-sm shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
      role="group"
    >
      {DISPLAY_UNITS.map((option) => (
        <button
          aria-pressed={displayUnit === option.value}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:focus-visible:outline-indigo-400 ${
            displayUnit === option.value
              ? 'bg-indigo-700 text-white shadow-sm ring-1 ring-indigo-700 dark:bg-indigo-400 dark:text-slate-950 dark:ring-indigo-300'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50'
          }`}
          key={option.value}
          onClick={() => setDisplayUnit(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
