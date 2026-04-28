import type { ThemePreference } from '@/lib/theme';
import { useUiStore } from '@/store/uiStore';

const THEME_OPTIONS: ReadonlyArray<{ label: string; value: ThemePreference }> = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export function ThemeSelect() {
  const themePreference = useUiStore((state) => state.themePreference);
  const setThemePreference = useUiStore((state) => state.setThemePreference);

  return (
    <div className="min-w-[8.5rem]">
      <select
        aria-label="Theme"
        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-0 text-sm font-medium text-slate-800 shadow-sm shadow-slate-900/5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-none dark:focus-visible:outline-indigo-400"
        onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
        value={themePreference}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
