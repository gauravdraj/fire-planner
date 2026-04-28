export function formControlClassName({
  className,
  invalid = false,
}: {
  className?: string;
  invalid?: boolean;
} = {}): string {
  return classNames(
    'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-950 shadow-sm shadow-slate-900/5 transition-colors placeholder:text-slate-400 hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-75 motion-reduce:transition-none dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:placeholder:text-slate-500 dark:hover:border-slate-500 dark:focus-visible:outline-indigo-400 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500',
    invalid
      ? 'border-red-600 ring-1 ring-red-600/20 focus-visible:outline-red-600 dark:border-red-400 dark:ring-red-400/20 dark:focus-visible:outline-red-400'
      : 'border-slate-300 dark:border-slate-700',
    className,
  );
}

export function checkboxControlClassName(className?: string): string {
  return classNames(
    'h-4 w-4 rounded border-slate-300 bg-white text-indigo-600 shadow-sm transition-colors hover:border-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 motion-reduce:transition-none dark:border-slate-600 dark:bg-slate-950 dark:text-indigo-400 dark:hover:border-indigo-400 dark:focus-visible:outline-indigo-400 dark:disabled:border-slate-800 dark:disabled:bg-slate-900',
    className,
  );
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
