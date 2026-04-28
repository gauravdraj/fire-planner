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
    <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
      Theme
      <select
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm shadow-slate-900/5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-none dark:focus-visible:outline-indigo-400"
        onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
        value={themePreference}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
