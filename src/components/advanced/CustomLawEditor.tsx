import { useEffect, useState } from 'react';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import { isCustomLawActive, type CustomLaw, type LawConstants } from '@/core/constants/customLaw';
import type { Bracket, FilingStatus } from '@/core/types';
import { classNames, formControlClassName } from '@/components/ui/controlStyles';
import { useScenarioStore } from '@/store/scenarioStore';

const FILING_STATUSES: readonly FilingStatus[] = ['single', 'mfj', 'hoh', 'mfs'];

const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: 'Single',
  mfj: 'Married filing jointly',
  hoh: 'Head of household',
  mfs: 'Married filing separately',
};

type StandardDeductionDraft = Record<FilingStatus, string>;
type BracketDraft = Record<FilingStatus, BracketInput[]>;
type BracketInput = {
  from: string;
  rate: string;
};

type MutableCustomLaw = {
  federal?: {
    standardDeduction?: Partial<Record<FilingStatus, number>>;
    ordinaryBrackets?: Partial<Record<FilingStatus, Bracket[]>>;
  };
  ltcg?: {
    brackets?: Partial<Record<FilingStatus, Bracket[]>>;
  };
  niit?: {
    rate?: number;
  };
};

const DEFAULTS = CONSTANTS_2026 as LawConstants;
const fieldsetClassName = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950';
const legendClassName = 'px-1 text-base font-semibold text-slate-950 dark:text-slate-50';
const labelClassName = 'block text-sm font-medium text-slate-800 dark:text-slate-200';
const secondaryButtonClassName =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:focus-visible:outline-indigo-400';
const primaryButtonClassName =
  'rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:bg-indigo-400 dark:text-slate-950 dark:hover:bg-indigo-300 dark:focus-visible:outline-indigo-400';

export function CustomLawEditor() {
  const customLaw = useScenarioStore((state) => state.customLaw);
  const setCustomLaw = useScenarioStore((state) => state.setCustomLaw);
  const [standardDeductionDraft, setStandardDeductionDraft] = useState<StandardDeductionDraft>(() =>
    standardDeductionDraftFromCustomLaw(customLaw),
  );
  const [ordinaryBracketDraft, setOrdinaryBracketDraft] = useState<BracketDraft>(() =>
    bracketDraftFromCustomLaw(DEFAULTS.federal.ordinaryBrackets, customLaw?.federal?.ordinaryBrackets),
  );
  const [ltcgBracketDraft, setLtcgBracketDraft] = useState<BracketDraft>(() =>
    bracketDraftFromCustomLaw(DEFAULTS.ltcg.brackets, customLaw?.ltcg?.brackets),
  );
  const [niitRateDraft, setNiitRateDraft] = useState(() => niitRateDraftFromCustomLaw(customLaw));
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    setStandardDeductionDraft(standardDeductionDraftFromCustomLaw(customLaw));
    setOrdinaryBracketDraft(bracketDraftFromCustomLaw(DEFAULTS.federal.ordinaryBrackets, customLaw?.federal?.ordinaryBrackets));
    setLtcgBracketDraft(bracketDraftFromCustomLaw(DEFAULTS.ltcg.brackets, customLaw?.ltcg?.brackets));
    setNiitRateDraft(niitRateDraftFromCustomLaw(customLaw));
  }, [customLaw]);

  function saveDraft() {
    const nextCustomLaw = buildCustomLawFromDrafts({
      standardDeductionDraft,
      ordinaryBracketDraft,
      ltcgBracketDraft,
      niitRateDraft,
    });

    setCustomLaw(nextCustomLaw);
    setSaveMessage(nextCustomLaw === undefined ? 'Custom-law overrides cleared.' : 'Custom-law edits saved.');
  }

  function resetStandardDeduction(status: FilingStatus) {
    setSaveMessage(`${FILING_STATUS_LABELS[status]} standard deduction override reset.`);
    setCustomLaw(removeStandardDeductionOverride(customLaw, status));
  }

  function resetOrdinaryBrackets(status: FilingStatus) {
    setSaveMessage(`${FILING_STATUS_LABELS[status]} ordinary bracket overrides reset.`);
    setCustomLaw(removeOrdinaryBracketOverride(customLaw, status));
  }

  function resetLtcgBrackets(status: FilingStatus) {
    setSaveMessage(`${FILING_STATUS_LABELS[status]} LTCG bracket overrides reset.`);
    setCustomLaw(removeLtcgBracketOverride(customLaw, status));
  }

  function resetNiitRate() {
    setSaveMessage('NIIT rate override reset.');
    setCustomLaw(removeNiitRateOverride(customLaw));
  }

  function resetAll() {
    setSaveMessage('All custom-law overrides reset.');
    setCustomLaw(undefined);
  }

  return (
    <form
      aria-label="Custom law editor"
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        saveDraft();
      }}
    >
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Custom law overrides are optional.</p>
        <p className="mt-1">
          Blank fields use the sealed 2026 defaults shown as placeholders. Saving writes only values that differ from
          those defaults.
        </p>
      </div>

      <fieldset className={fieldsetClassName}>
        <legend className={legendClassName}>Federal standard deduction</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {FILING_STATUSES.map((status) => (
            <div key={status}>
              <label className={labelClassName} htmlFor={`standard-deduction-${status}`}>
                {FILING_STATUS_LABELS[status]}
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  className={formControlClassName()}
                  id={`standard-deduction-${status}`}
                  inputMode="decimal"
                  min="0"
                  onChange={(event) =>
                    setStandardDeductionDraft((draft) => ({ ...draft, [status]: event.target.value }))
                  }
                  placeholder={String(DEFAULTS.federal.standardDeduction[status])}
                  type="number"
                  value={standardDeductionDraft[status]}
                />
                <button
                  aria-label={`Reset standard deduction ${FILING_STATUS_LABELS[status]}`}
                  className={secondaryButtonClassName}
                  onClick={() => resetStandardDeduction(status)}
                  type="button"
                >
                  Reset
                </button>
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <BracketEditor
        draft={ordinaryBracketDraft}
        label="Federal ordinary brackets"
        onChange={setOrdinaryBracketDraft}
        onReset={resetOrdinaryBrackets}
        table={DEFAULTS.federal.ordinaryBrackets}
      />

      <BracketEditor
        draft={ltcgBracketDraft}
        label="Long-term capital gains brackets"
        onChange={setLtcgBracketDraft}
        onReset={resetLtcgBrackets}
        table={DEFAULTS.ltcg.brackets}
      />

      <fieldset className={fieldsetClassName}>
        <legend className={legendClassName}>NIIT rate</legend>
        <div className="mt-3 max-w-sm">
          <label className={labelClassName} htmlFor="niit-rate">
            Net investment income tax rate
          </label>
          <div className="mt-1 flex gap-2">
            <input
              className={formControlClassName()}
              id="niit-rate"
              inputMode="decimal"
              min="0"
              onChange={(event) => setNiitRateDraft(event.target.value)}
              placeholder={String(DEFAULTS.niit.rate)}
              step="0.001"
              type="number"
              value={niitRateDraft}
            />
            <button
              className={secondaryButtonClassName}
              onClick={resetNiitRate}
              type="button"
            >
              Reset
            </button>
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-h-5 text-sm text-slate-600 dark:text-slate-300">
          {saveMessage}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={classNames(secondaryButtonClassName, 'px-4')}
            onClick={resetAll}
            type="button"
          >
            Reset all custom-law overrides
          </button>
          <button className={primaryButtonClassName} type="submit">
            Save custom law edits
          </button>
        </div>
      </div>
    </form>
  );
}

function BracketEditor({
  draft,
  label,
  onChange,
  onReset,
  table,
}: {
  draft: BracketDraft;
  label: string;
  onChange: (draft: BracketDraft) => void;
  onReset: (status: FilingStatus) => void;
  table: Record<FilingStatus, readonly Bracket[]>;
}) {
  return (
    <fieldset className={fieldsetClassName}>
      <legend className={legendClassName}>{label}</legend>
      <div className="mt-4 space-y-5">
        {FILING_STATUSES.map((status) => (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50" key={status}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="font-medium text-slate-950 dark:text-slate-50">{FILING_STATUS_LABELS[status]}</h4>
              <button
                className={classNames(secondaryButtonClassName, 'self-start py-1.5 sm:self-auto')}
                onClick={() => onReset(status)}
                type="button"
              >
                Reset {FILING_STATUS_LABELS[status]} brackets
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {table[status].map((bracket, index) => (
                <div className="grid gap-2 sm:grid-cols-2" key={`${status}-${index}`}>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Bracket {index + 1} floor
                    <input
                      aria-label={`${label} ${FILING_STATUS_LABELS[status]} bracket ${index + 1} floor`}
                      className={formControlClassName({ className: 'mt-1' })}
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => {
                        onChange(updateBracketDraft(draft, status, index, 'from', event.target.value));
                      }}
                      placeholder={String(bracket.from)}
                      type="number"
                      value={draft[status][index]?.from ?? ''}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Bracket {index + 1} rate
                    <input
                      aria-label={`${label} ${FILING_STATUS_LABELS[status]} bracket ${index + 1} rate`}
                      className={formControlClassName({ className: 'mt-1' })}
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => {
                        onChange(updateBracketDraft(draft, status, index, 'rate', event.target.value));
                      }}
                      placeholder={String(bracket.rate)}
                      step="0.01"
                      type="number"
                      value={draft[status][index]?.rate ?? ''}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function standardDeductionDraftFromCustomLaw(customLaw: CustomLaw | undefined): StandardDeductionDraft {
  return Object.fromEntries(
    FILING_STATUSES.map((status) => {
      const override = customLaw?.federal?.standardDeduction?.[status];
      const defaultValue = DEFAULTS.federal.standardDeduction[status];

      return [status, override === undefined || override === defaultValue ? '' : String(override)];
    }),
  ) as StandardDeductionDraft;
}

function bracketDraftFromCustomLaw(
  defaultTable: Record<FilingStatus, readonly Bracket[]>,
  overrideTable: Partial<Record<FilingStatus, readonly Bracket[]>> | undefined,
): BracketDraft {
  return Object.fromEntries(
    FILING_STATUSES.map((status) => [
      status,
      defaultTable[status].map((defaultBracket, index) => {
        const override = overrideTable?.[status]?.[index];

        return {
          from: override === undefined || override.from === defaultBracket.from ? '' : String(override.from),
          rate: override === undefined || override.rate === defaultBracket.rate ? '' : String(override.rate),
        };
      }),
    ]),
  ) as BracketDraft;
}

function niitRateDraftFromCustomLaw(customLaw: CustomLaw | undefined): string {
  const override = customLaw?.niit?.rate;

  return override === undefined || override === DEFAULTS.niit.rate ? '' : String(override);
}

function updateBracketDraft(
  draft: BracketDraft,
  status: FilingStatus,
  index: number,
  field: keyof BracketInput,
  value: string,
): BracketDraft {
  return {
    ...draft,
    [status]: draft[status].map((bracket, bracketIndex) =>
      bracketIndex === index ? { ...bracket, [field]: value } : bracket,
    ),
  };
}

function buildCustomLawFromDrafts({
  standardDeductionDraft,
  ordinaryBracketDraft,
  ltcgBracketDraft,
  niitRateDraft,
}: {
  standardDeductionDraft: StandardDeductionDraft;
  ordinaryBracketDraft: BracketDraft;
  ltcgBracketDraft: BracketDraft;
  niitRateDraft: string;
}): CustomLaw | undefined {
  const law: MutableCustomLaw = {};
  const standardDeduction = valuesByStatus(standardDeductionDraft, DEFAULTS.federal.standardDeduction);

  if (standardDeduction !== undefined) {
    law.federal = { ...law.federal, standardDeduction };
  }

  const ordinaryBrackets = bracketOverridesByStatus(ordinaryBracketDraft, DEFAULTS.federal.ordinaryBrackets);

  if (ordinaryBrackets !== undefined) {
    law.federal = { ...law.federal, ordinaryBrackets };
  }

  const ltcgBrackets = bracketOverridesByStatus(ltcgBracketDraft, DEFAULTS.ltcg.brackets);

  if (ltcgBrackets !== undefined) {
    law.ltcg = { brackets: ltcgBrackets };
  }

  const niitRate = numericDraftValue(niitRateDraft);

  if (niitRate !== null && niitRate !== DEFAULTS.niit.rate) {
    law.niit = { rate: niitRate };
  }

  return compactCustomLaw(law);
}

function valuesByStatus(
  draft: StandardDeductionDraft,
  defaults: Record<FilingStatus, number>,
): Partial<Record<FilingStatus, number>> | undefined {
  const values: Partial<Record<FilingStatus, number>> = {};

  for (const status of FILING_STATUSES) {
    const value = numericDraftValue(draft[status]);

    if (value !== null && value !== defaults[status]) {
      values[status] = value;
    }
  }

  return Object.keys(values).length === 0 ? undefined : values;
}

function bracketOverridesByStatus(
  draft: BracketDraft,
  defaults: Record<FilingStatus, readonly Bracket[]>,
): Partial<Record<FilingStatus, Bracket[]>> | undefined {
  const values: Partial<Record<FilingStatus, Bracket[]>> = {};

  for (const status of FILING_STATUSES) {
    const rows = defaults[status].map((defaultBracket, index) => {
      const draftRow = draft[status][index];

      return {
        from: numericDraftValue(draftRow?.from ?? '') ?? defaultBracket.from,
        rate: numericDraftValue(draftRow?.rate ?? '') ?? defaultBracket.rate,
      };
    });

    if (rows.some((row, index) => row.from !== defaults[status][index]?.from || row.rate !== defaults[status][index]?.rate)) {
      values[status] = rows;
    }
  }

  return Object.keys(values).length === 0 ? undefined : values;
}

function numericDraftValue(value: string): number | null {
  const trimmed = value.trim().replaceAll(',', '');

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function removeStandardDeductionOverride(customLaw: CustomLaw | undefined, status: FilingStatus): CustomLaw | undefined {
  const law = cloneMutableCustomLaw(customLaw);

  delete law.federal?.standardDeduction?.[status];

  return compactCustomLaw(law);
}

function removeOrdinaryBracketOverride(customLaw: CustomLaw | undefined, status: FilingStatus): CustomLaw | undefined {
  const law = cloneMutableCustomLaw(customLaw);

  delete law.federal?.ordinaryBrackets?.[status];

  return compactCustomLaw(law);
}

function removeLtcgBracketOverride(customLaw: CustomLaw | undefined, status: FilingStatus): CustomLaw | undefined {
  const law = cloneMutableCustomLaw(customLaw);

  delete law.ltcg?.brackets?.[status];

  return compactCustomLaw(law);
}

function removeNiitRateOverride(customLaw: CustomLaw | undefined): CustomLaw | undefined {
  const law = cloneMutableCustomLaw(customLaw);

  delete law.niit?.rate;

  return compactCustomLaw(law);
}

function cloneMutableCustomLaw(customLaw: CustomLaw | undefined): MutableCustomLaw {
  return customLaw === undefined ? {} : (JSON.parse(JSON.stringify(customLaw)) as MutableCustomLaw);
}

function compactCustomLaw(law: MutableCustomLaw): CustomLaw | undefined {
  if (law.federal?.standardDeduction !== undefined && Object.keys(law.federal.standardDeduction).length === 0) {
    delete law.federal.standardDeduction;
  }

  if (law.federal?.ordinaryBrackets !== undefined && Object.keys(law.federal.ordinaryBrackets).length === 0) {
    delete law.federal.ordinaryBrackets;
  }

  if (law.federal !== undefined && Object.keys(law.federal).length === 0) {
    delete law.federal;
  }

  if (law.ltcg?.brackets !== undefined && Object.keys(law.ltcg.brackets).length === 0) {
    delete law.ltcg.brackets;
  }

  if (law.ltcg !== undefined && Object.keys(law.ltcg).length === 0) {
    delete law.ltcg;
  }

  if (law.niit !== undefined && Object.keys(law.niit).length === 0) {
    delete law.niit;
  }

  return isCustomLawActive(law) ? law : undefined;
}
