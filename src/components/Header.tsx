import { LayoutToggle } from './LayoutToggle';
import { ModeToggle } from './ModeToggle';
import { RealNominalToggle } from './RealNominalToggle';
import { ShareButton } from './ShareButton';
import { ThemeSelect } from './ThemeSelect';
import { useUiStore } from '@/store/uiStore';

export function Header() {
  const layout = useUiStore((state) => state.layout);

  return (
    <header className="border-b border-slate-200/80 bg-white/90 px-3 py-5 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-none sm:px-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Private retirement planner</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">Fire Planner</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Free, open-source, client-only, fixture-validated, transparent FIRE planning.
          </p>
        </div>
        <div
          aria-label="Planner controls"
          className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
          role="group"
        >
          {layout === 'classic' ? <ModeToggle /> : <PlanNavigation />}
          <RealNominalToggle />
          <LayoutToggle />
          <ThemeSelect />
          <ShareButton />
        </div>
      </div>
    </header>
  );
}

function PlanNavigation() {
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);

  return (
    <div
      aria-label="Plan navigation"
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-300 bg-white p-1 shadow-sm shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
      role="group"
    >
      <button
        aria-pressed={view === 'plan'}
        className={planNavigationButtonClassName(view === 'plan')}
        onClick={() => setView('plan')}
        type="button"
      >
        Plan
      </button>
      <button
        aria-pressed={view === 'compare'}
        className={planNavigationButtonClassName(view === 'compare')}
        onClick={() => setView('compare')}
        type="button"
      >
        Compare
      </button>
    </div>
  );
}

function planNavigationButtonClassName(isActive: boolean): string {
  return `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:focus-visible:outline-indigo-400 ${
    isActive
      ? 'bg-slate-950 text-white shadow-sm ring-1 ring-slate-950 dark:bg-slate-100 dark:text-slate-950 dark:ring-slate-100'
      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50'
  }`;
}
