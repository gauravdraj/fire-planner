import type { ReactNode } from 'react';

import { classNames } from '@/components/ui/controlStyles';

type PlannerCardProps = Readonly<{
  eyebrow?: string;
  question: string;
  headline: ReactNode;
  detail: ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  statusLine?: ReactNode;
}>;

export function PlannerCard({ ctaLabel, detail, eyebrow = 'What if?', headline, onCta, question, statusLine }: PlannerCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-none">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">{eyebrow}</p>
      <h4 className="mt-1 text-sm font-semibold leading-6 text-slate-950 dark:text-slate-50">{question}</h4>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-slate-50">{headline}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
      {statusLine === undefined ? null : (
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{statusLine}</p>
      )}
      {ctaLabel === undefined || onCta === undefined ? null : (
        <button
          className={classNames(
            'mt-4 inline-flex rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none',
            'dark:bg-indigo-400 dark:text-slate-950 dark:hover:bg-indigo-300 dark:focus-visible:outline-indigo-400',
          )}
          onClick={onCta}
          type="button"
        >
          {ctaLabel}
        </button>
      )}
    </article>
  );
}
