import { useId, type ReactNode } from 'react';

type InfoTooltipProps = Readonly<{
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}>;

export function InfoTooltip({ ariaLabel = 'More information', children, className = '' }: InfoTooltipProps) {
  const tooltipId = useId();

  return (
    <span className={`group relative inline-flex items-center ${className}`}>
      <button
        aria-describedby={tooltipId}
        aria-label={ariaLabel}
        className="peer inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[0.65rem] font-semibold leading-none text-slate-500 transition-colors hover:border-indigo-400 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-600 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-indigo-300 dark:hover:text-indigo-200 dark:focus-visible:outline-indigo-400"
        type="button"
      >
        i
      </button>
      <span
        className="invisible absolute right-0 top-5 z-20 w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal leading-snug text-slate-700 opacity-0 shadow-lg shadow-slate-900/10 transition-opacity duration-150 peer-hover:visible peer-hover:opacity-100 peer-focus:visible peer-focus:opacity-100 peer-focus-visible:visible peer-focus-visible:opacity-100 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:shadow-black/40"
        id={tooltipId}
        role="tooltip"
      >
        {children}
      </span>
    </span>
  );
}
