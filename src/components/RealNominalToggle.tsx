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
    <div aria-label="Display dollars" className="inline-flex rounded-md border border-slate-300 bg-white p-1">
      {DISPLAY_UNITS.map((option) => (
        <button
          aria-pressed={displayUnit === option.value}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            displayUnit === option.value ? 'bg-indigo-700 text-white' : 'text-slate-700 hover:bg-slate-100'
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
