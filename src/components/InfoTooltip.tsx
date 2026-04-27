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
        className="peer inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[0.65rem] font-semibold leading-none text-slate-500 hover:border-indigo-400 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        type="button"
      >
        i
      </button>
      <span
        className="invisible absolute right-0 top-5 z-20 w-56 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal leading-snug text-slate-700 opacity-0 shadow-lg transition-opacity duration-150 peer-hover:visible peer-hover:opacity-100 peer-focus:visible peer-focus:opacity-100 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        id={tooltipId}
        role="tooltip"
      >
        {children}
      </span>
    </span>
  );
}
