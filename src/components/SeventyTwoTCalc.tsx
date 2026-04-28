import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';

import { compute72tIraSize } from '@/core/seventyTwoT';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';

import { formControlClassName } from './ui/controlStyles';

type CalculatorDraft = {
  annualIncome: string;
  lifeExpectancyYears: string;
  ratePercent: string;
};

type CalculatorInputs = {
  annualIncome: number;
  lifeExpectancyYears: number;
  ratePercent: number;
};

const DEFAULT_DRAFT: CalculatorDraft = {
  annualIncome: '50000',
  lifeExpectancyYears: '33.4',
  ratePercent: '5',
};

const LIVE_UPDATE_DELAY_MS = 150;

const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: 'currency',
});

export function SeventyTwoTCalc() {
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [inputs, setInputs] = useState<CalculatorInputs | null>(() => parseDraft(DEFAULT_DRAFT));
  const fieldErrors = {
    annualIncome: fieldError(draft.annualIncome, 'Enter zero or greater.'),
    lifeExpectancyYears: fieldError(draft.lifeExpectancyYears, 'Enter zero or greater.'),
    ratePercent: fieldError(draft.ratePercent, 'Enter zero or greater.'),
  };
  const commitDraft = useDebouncedCallback((nextDraft: CalculatorDraft) => {
    setInputs(parseDraft(nextDraft));
  }, LIVE_UPDATE_DELAY_MS);
  const requiredIraSize = useMemo(() => {
    if (inputs === null) {
      return null;
    }

    return compute72tIraSize(inputs.ratePercent / 100, inputs.lifeExpectancyYears, inputs.annualIncome);
  }, [inputs]);

  function handleInputChange(field: keyof CalculatorDraft) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;

      setDraft((currentDraft) => {
        const nextDraft = { ...currentDraft, [field]: value };

        commitDraft(nextDraft);

        return nextDraft;
      });
    };
  }

  return (
    <div aria-label="72(t) calculator inputs" className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field error={fieldErrors.ratePercent} id="seventyTwoTRatePercent" label="Rate percent">
          <input
            aria-describedby={fieldErrors.ratePercent === null ? undefined : 'seventyTwoTRatePercent-error'}
            aria-invalid={fieldErrors.ratePercent === null ? undefined : 'true'}
            className={inputClassName(fieldErrors.ratePercent)}
            id="seventyTwoTRatePercent"
            inputMode="decimal"
            min="0"
            onChange={handleInputChange('ratePercent')}
            step="0.1"
            type="number"
            value={draft.ratePercent}
          />
        </Field>
        <Field error={fieldErrors.lifeExpectancyYears} id="seventyTwoTLifeExpectancyYears" label="Life expectancy years">
          <input
            aria-describedby={fieldErrors.lifeExpectancyYears === null ? undefined : 'seventyTwoTLifeExpectancyYears-error'}
            aria-invalid={fieldErrors.lifeExpectancyYears === null ? undefined : 'true'}
            className={inputClassName(fieldErrors.lifeExpectancyYears)}
            id="seventyTwoTLifeExpectancyYears"
            inputMode="decimal"
            min="0"
            onChange={handleInputChange('lifeExpectancyYears')}
            step="0.1"
            type="number"
            value={draft.lifeExpectancyYears}
          />
        </Field>
        <Field error={fieldErrors.annualIncome} id="seventyTwoTAnnualIncome" label="Desired annual income">
          <input
            aria-describedby={fieldErrors.annualIncome === null ? undefined : 'seventyTwoTAnnualIncome-error'}
            aria-invalid={fieldErrors.annualIncome === null ? undefined : 'true'}
            className={inputClassName(fieldErrors.annualIncome)}
            id="seventyTwoTAnnualIncome"
            inputMode="decimal"
            min="0"
            onChange={handleInputChange('annualIncome')}
            step="1000"
            type="number"
            value={draft.annualIncome}
          />
        </Field>
      </div>

      <output
        aria-live="polite"
        className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm shadow-indigo-950/5 dark:border-indigo-400/30 dark:bg-slate-950/70 dark:shadow-none"
        htmlFor="seventyTwoTRatePercent seventyTwoTLifeExpectancyYears seventyTwoTAnnualIncome"
      >
        <span className="block text-sm font-medium text-slate-600 dark:text-slate-400">Required IRA size</span>
        <span className="mt-2 block text-2xl font-semibold tabular-nums text-slate-950 dark:text-slate-50">
          {requiredIraSize === null ? '-' : MONEY_FORMATTER.format(requiredIraSize)}
        </span>
      </output>
    </div>
  );
}

function Field({
  children,
  error,
  id,
  label,
}: {
  children: ReactNode;
  error: string | null;
  id: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-800 dark:text-slate-200" htmlFor={id}>
        {label}
      </label>
      {children}
      {error === null ? null : (
        <p className="text-sm font-medium text-red-700 dark:text-red-300" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function inputClassName(error: string | null): string {
  return formControlClassName({ className: 'tabular-nums', invalid: error !== null });
}

function parseDraft(draft: CalculatorDraft): CalculatorInputs | null {
  const ratePercent = parseNonNegativeNumber(draft.ratePercent);
  const lifeExpectancyYears = parseNonNegativeNumber(draft.lifeExpectancyYears);
  const annualIncome = parseNonNegativeNumber(draft.annualIncome);

  if (ratePercent === null || lifeExpectancyYears === null || annualIncome === null) {
    return null;
  }

  return { annualIncome, lifeExpectancyYears, ratePercent };
}

function parseNonNegativeNumber(rawValue: string): number | null {
  if (rawValue.trim() === '') {
    return null;
  }

  const value = Number(rawValue);

  return Number.isFinite(value) && value >= 0 ? value : null;
}

function fieldError(rawValue: string, message: string): string | null {
  return parseNonNegativeNumber(rawValue) === null ? message : null;
}
