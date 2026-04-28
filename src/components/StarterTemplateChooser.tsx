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
      className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-950/35 dark:shadow-none"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h3
            className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400"
            id="starter-template-heading"
          >
            Sample scenarios
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Optional shortcuts that load a complete basic form without adding advanced plan state.
          </p>
        </div>
        {loadConfirmation === null ? null : (
          <p
            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 shadow-sm shadow-emerald-950/5 dark:border-emerald-400/30 dark:bg-emerald-950/30 dark:text-emerald-200 dark:shadow-none"
            role="status"
          >
            Loaded '{loadConfirmation.label}' — change any field to customize.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {STARTER_TEMPLATES.map((template) => (
          <button
            className="max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-sm shadow-slate-900/5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/60 active:border-indigo-500 active:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none dark:hover:border-indigo-400/60 dark:hover:bg-indigo-950/25 dark:active:bg-indigo-950/40 dark:focus-visible:outline-indigo-400"
            key={template.id}
            onClick={() => loadTemplate(template)}
            type="button"
          >
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{template.label}</span>
            <span className="mt-0.5 block max-w-[18rem] text-xs leading-5 text-slate-500 dark:text-slate-400">
              {template.shortDescription}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
        Samples update the projection instantly; use them as quick contrasts after reviewing the default household.
      </p>
    </section>
  );
}
