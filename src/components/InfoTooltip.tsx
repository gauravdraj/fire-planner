import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

type InfoTooltipProps = Readonly<{
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}>;

export function InfoTooltip({ ariaLabel = 'More information', children, className = '' }: InfoTooltipProps) {
  const tooltipId = useId();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissedForFocus, setIsDismissedForFocus] = useState(false);

  function showFromPointer() {
    setIsDismissedForFocus(false);
    setIsVisible(true);
  }

  function showFromFocus() {
    if (!isDismissedForFocus) {
      setIsVisible(true);
    }
  }

  function hide() {
    setIsVisible(false);
  }

  function handleBlur() {
    setIsDismissedForFocus(false);
    hide();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setIsDismissedForFocus(true);
    hide();
  }

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        aria-describedby={tooltipId}
        aria-label={ariaLabel}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[0.65rem] font-semibold leading-none text-slate-500 hover:border-indigo-400 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        onBlur={handleBlur}
        onFocus={showFromFocus}
        onKeyDown={handleKeyDown}
        onMouseEnter={showFromPointer}
        onMouseLeave={hide}
        type="button"
      >
        i
      </button>
      <span
        className="absolute right-0 top-5 z-20 w-56 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal leading-snug text-slate-700 shadow-lg"
        hidden={!isVisible}
        id={tooltipId}
        role="tooltip"
      >
        {children}
      </span>
    </span>
  );
}
