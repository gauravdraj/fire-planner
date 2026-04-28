import { ModeToggle } from './ModeToggle';
import { RealNominalToggle } from './RealNominalToggle';
import { ShareButton } from './ShareButton';
import { ThemeSelect } from './ThemeSelect';

export function Header() {
  return (
    <header className="border-b border-slate-200/80 bg-white/90 px-3 py-5 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-none sm:px-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:max-w-6xl xl:max-w-7xl sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Browser-only planner</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">Fire Planner</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Local retirement projections, tax thresholds, and share/export controls without an account.
          </p>
        </div>
        <div
          aria-label="Planner controls"
          className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
          role="group"
        >
          <ModeToggle />
          <RealNominalToggle />
          <ThemeSelect />
          <ShareButton />
        </div>
      </div>
    </header>
  );
}
