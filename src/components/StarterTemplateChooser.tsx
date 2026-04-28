import { useEffect, useState } from 'react';

import { STARTER_TEMPLATES, type StarterTemplate } from '@/lib/starterTemplates';
import { DEFAULT_BASIC_FORM_VALUES, useScenarioStore } from '@/store/scenarioStore';

const SUCCESS_MESSAGE_DURATION_MS = 5_000;

export function StarterTemplateChooser() {
  const replaceFormValues = useScenarioStore((state) => state.replaceFormValues);
  const [loadConfirmation, setLoadConfirmation] = useState<{ label: string } | null>(null);

  useEffect(() => {
    if (loadConfirmation === null) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setLoadConfirmation(null), SUCCESS_MESSAGE_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [loadConfirmation]);

  function loadTemplate(template: StarterTemplate) {
    replaceFormValues({ ...DEFAULT_BASIC_FORM_VALUES, ...template.formValues });
    setLoadConfirmation({ label: template.label });
  }

  return (
    <section
      aria-labelledby="starter-template-heading"
      className="mt-6 rounded-xl border border-indigo-200/80 bg-indigo-50/70 p-4 shadow-sm shadow-indigo-950/5 dark:border-indigo-400/20 dark:bg-indigo-950/20 dark:shadow-none"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50" id="starter-template-heading">
            Try a sample scenario:
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Load a complete basic form first, then adjust any assumption. Templates do not add advanced plan state.
          </p>
        </div>
        {loadConfirmation === null ? null : (
          <p
            className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm shadow-indigo-950/5 dark:border-indigo-400/30 dark:bg-indigo-950/50 dark:text-indigo-200 dark:shadow-none"
            role="status"
          >
            Loaded '{loadConfirmation.label}' — change any field to customize.
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
        {STARTER_TEMPLATES.map((template) => (
          <button
            className="rounded-xl border border-indigo-200 bg-white p-4 text-left shadow-sm shadow-indigo-950/5 transition-colors hover:border-indigo-500 hover:bg-indigo-50 active:border-indigo-700 active:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-indigo-400/30 dark:bg-slate-950/70 dark:shadow-none dark:hover:border-indigo-300 dark:hover:bg-indigo-950/40 dark:active:bg-indigo-950/60 dark:focus-visible:outline-indigo-400"
            key={template.id}
            onClick={() => loadTemplate(template)}
            type="button"
          >
            <span className="block text-sm font-semibold text-indigo-800 dark:text-indigo-200">{template.label}</span>
            <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-400">{template.shortDescription}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
        These examples show two common FIRE bridge strategies and update the projection instantly when loaded. The
        72(t) context scenario illustrates using taxable brokerage as a 10-year bridge around SEPP planning, while the
        Roth ladder scenario shows a shorter brokerage bridge that preserves room to manage future conversions.
      </p>
    </section>
  );
}
