import type { PlannerMode } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

const MODES: ReadonlyArray<{ label: string; value: PlannerMode }> = [
  { label: 'Basic', value: 'basic' },
  { label: 'Advanced', value: 'advanced' },
  { label: 'Compare', value: 'compare' },
  { label: 'Methodology', value: 'methodology' },
];

export function ModeToggle() {
  const mode = useUiStore((state) => state.mode);
  const setMode = useUiStore((state) => state.setMode);

  return (
    <div
      aria-label="Planner mode"
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-300 bg-white p-1 shadow-sm shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
      role="group"
    >
      {MODES.map((option) => (
        <button
          aria-pressed={mode === option.value}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:focus-visible:outline-indigo-400 ${
            mode === option.value
              ? 'bg-slate-950 text-white shadow-sm ring-1 ring-slate-950 dark:bg-slate-100 dark:text-slate-950 dark:ring-slate-100'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50'
          }`}
          key={option.value}
          onClick={() => setMode(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
