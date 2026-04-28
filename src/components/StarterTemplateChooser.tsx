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
    <section aria-labelledby="starter-template-heading" className="mt-6 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950" id="starter-template-heading">
            Try a sample scenario:
          </h3>
        </div>
        {loadConfirmation === null ? null : (
          <p className="rounded-md bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm" role="status">
            Loaded '{loadConfirmation.label}' — change any field to customize.
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
        {STARTER_TEMPLATES.map((template) => (
          <button
            className="rounded-lg border border-indigo-300 bg-white p-4 text-left shadow-sm transition hover:border-indigo-500 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            key={template.id}
            onClick={() => loadTemplate(template)}
            type="button"
          >
            <span className="block text-sm font-semibold text-indigo-800">{template.label}</span>
            <span className="mt-1 block text-sm text-slate-600">{template.shortDescription}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-600">
        These examples show two common FIRE bridge strategies and update the projection instantly when loaded. The
        72(t) context scenario illustrates using taxable brokerage as a 10-year bridge around SEPP planning, while the
        Roth ladder scenario shows a shorter brokerage bridge that preserves room to manage future conversions.
      </p>
    </section>
  );
}
