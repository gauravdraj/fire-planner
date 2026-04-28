import { useUiStore } from '@/store/uiStore';

export function Footer() {
  const layout = useUiStore((state) => state.layout);
  const setView = useUiStore((state) => state.setView);

  return (
    <footer className="border-t border-slate-200/80 bg-slate-100 px-4 py-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 lg:max-w-6xl xl:max-w-7xl">
        <p>All inputs stay on your device.</p>
        {layout === 'verdict' ? (
          <a
            className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-4 transition-colors hover:text-indigo-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:text-indigo-300 dark:decoration-indigo-500/70 dark:hover:text-indigo-100 dark:focus-visible:outline-indigo-400"
            href="#methodology"
            onClick={(event) => {
              event.preventDefault();
              setView('methodology');
            }}
          >
            Methodology
          </a>
        ) : null}
      </div>
    </footer>
  );
}
