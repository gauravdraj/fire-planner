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
    <div aria-label="Planner mode" className="inline-flex rounded-md border border-slate-300 bg-white p-1">
      {MODES.map((option) => (
        <button
          aria-pressed={mode === option.value}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            mode === option.value ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
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
