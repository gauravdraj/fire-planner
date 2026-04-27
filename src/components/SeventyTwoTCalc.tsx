import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';

import { compute72tIraSize } from '@/core/seventyTwoT';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';

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
        <Field id="seventyTwoTRatePercent" label="Rate percent">
          <input
            className={inputClassName()}
            id="seventyTwoTRatePercent"
            inputMode="decimal"
            min="0"
            onChange={handleInputChange('ratePercent')}
            step="0.1"
            type="number"
            value={draft.ratePercent}
          />
        </Field>
        <Field id="seventyTwoTLifeExpectancyYears" label="Life expectancy years">
          <input
            className={inputClassName()}
            id="seventyTwoTLifeExpectancyYears"
            inputMode="decimal"
            min="0"
            onChange={handleInputChange('lifeExpectancyYears')}
            step="0.1"
            type="number"
            value={draft.lifeExpectancyYears}
          />
        </Field>
        <Field id="seventyTwoTAnnualIncome" label="Desired annual income">
          <input
            className={inputClassName()}
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
        className="rounded-lg border border-indigo-200 bg-white p-4 shadow-sm"
        htmlFor="seventyTwoTRatePercent seventyTwoTLifeExpectancyYears seventyTwoTAnnualIncome"
      >
        <span className="block text-sm font-medium text-slate-600">Required IRA size</span>
        <span className="mt-2 block text-2xl font-semibold tabular-nums text-slate-950">
          {requiredIraSize === null ? '-' : MONEY_FORMATTER.format(requiredIraSize)}
        </span>
      </output>
    </div>
  );
}

function Field({ children, id, label }: { children: ReactNode; id: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-800" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

function inputClassName(): string {
  return 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600';
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
