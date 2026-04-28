import { useEffect, useMemo, useState } from 'react';

import { effectiveConstants } from '@/core/constants/customLaw';
import {
  generateRothLadderPlan,
  type RothLadderConstraint,
  type RothLadderConstraintStatus,
  type RothLadderYearResult,
} from '@/core/planners/rothLadderTargeter';
import type { Scenario, WithdrawalPlan } from '@/core/projection';
import { toReal } from '@/lib/realDollars';
import { classNames, formControlClassName } from '@/components/ui/controlStyles';
import { useScenarioStore } from '@/store/scenarioStore';
import type { DisplayUnit } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';

type ConstraintKind = RothLadderConstraint['kind'];
export const ROTH_LADDER_TARGET_ID = 'roth-ladder-targeter';

const plannerPanelClassName = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950';
const eyebrowClassName = 'text-sm font-medium text-indigo-700 dark:text-indigo-300';
const headingClassName = 'mt-1 text-base font-semibold text-slate-950 dark:text-slate-50';
const helpTextClassName = 'text-sm leading-6 text-slate-600 dark:text-slate-300';
const labelClassName = 'text-sm font-medium text-slate-800 dark:text-slate-200';
const primaryButtonClassName =
  'rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 motion-reduce:transition-none dark:bg-indigo-400 dark:text-slate-950 dark:hover:bg-indigo-300 dark:focus-visible:outline-indigo-400';

export function RothLadderUI() {
  const scenario = useScenarioStore((state) => state.scenario);
  const plan = useScenarioStore((state) => state.plan);
  const setPlan = useScenarioStore((state) => state.setPlan);
  const displayUnit = useUiStore((state) => state.displayUnit);
  const defaultRange = useMemo(
    () => defaultRothLadderPlannerRange(scenario, plan),
    [plan.endYear, scenario.socialSecurity?.claimYear, scenario.startYear],
  );
  const constants = effectiveConstants(scenario);
  const irmaaTierOptions = constants.irmaa.partBTiers[scenario.filingStatus]
    .map((tier, index) => ({ index, upperBound: tierUpperBound(tier) }))
    .filter((tier): tier is { index: number; upperBound: number } => tier.upperBound !== null);
  const federalBracketRates = constants.federal.ordinaryBrackets[scenario.filingStatus]
    .slice(0, -1)
    .map((bracket) => bracket.rate);
  const ltcgBracketRates = constants.ltcg.brackets[scenario.filingStatus].slice(0, -1).map((bracket) => bracket.rate);
  const [startYear, setStartYear] = useState(defaultRange.startYear);
  const [endYear, setEndYear] = useState(defaultRange.endYear);
  const [constraintKind, setConstraintKind] = useState<ConstraintKind>('federalBracket');
  const [irmaaTier, setIrmaaTier] = useState(irmaaTierOptions[0]?.index ?? 0);
  const [acaFplPercent, setAcaFplPercent] = useState('4');
  const [federalBracketRate, setFederalBracketRate] = useState(defaultFederalBracketRate(federalBracketRates));
  const [ltcgBracketRate, setLtcgBracketRate] = useState(ltcgBracketRates[0] ?? 0);
  const [maxConversion, setMaxConversion] = useState('');
  const [years, setYears] = useState<readonly RothLadderYearResult[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setStartYear(defaultRange.startYear);
    setEndYear(defaultRange.endYear);
  }, [defaultRange.startYear, defaultRange.endYear]);

  function generatePlan() {
    try {
      const parsedMaxConversion = parseOptionalMoney(maxConversion);
      const result = generateRothLadderPlan({
        scenario,
        basePlan: plan,
        startYear: clampYear(startYear, scenario.startYear, plan.endYear),
        endYear: clampYear(Math.max(startYear, endYear), scenario.startYear, plan.endYear),
        constraint: buildRothLadderConstraint({
          acaFplPercent,
          constraintKind,
          federalBracketRate,
          federalBracketRates,
          irmaaTier,
          irmaaTierOptions,
          ltcgBracketRate,
          ltcgBracketRates,
        }),
        ...(parsedMaxConversion !== undefined ? { maxConversion: parsedMaxConversion } : {}),
      });

      setPlan(result.plan);
      setYears(result.years);
      setMessage(`Generated Roth ladder actions for ${result.years.length} years.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to generate Roth ladder plan.');
    }
  }

  return (
    <section aria-labelledby="roth-ladder-heading" className={plannerPanelClassName} id={ROTH_LADDER_TARGET_ID}>
      <div>
        <p className={eyebrowClassName}>Roth ladder targeter</p>
        <h3 className={headingClassName} id="roth-ladder-heading">
          Generate Roth conversions
        </h3>
        <p className={classNames(helpTextClassName, 'mt-1')}>
          Pick one binding constraint and write annual Roth conversion actions into the manual plan.
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-600 dark:text-slate-300">IRMAA T+2:</span> Year T IRMAA MAGI drives
          the year T+2 Medicare premium bill, so results show the later premium year affected by each conversion year.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="Roth start year" onChange={setStartYear} value={startYear} />
        <NumberField label="Roth end year" onChange={setEndYear} value={endYear} />
        <label className={labelClassName}>
          Binding constraint
          <select
            className={formControlClassName({ className: 'mt-1' })}
            onChange={(event) => setConstraintKind(event.target.value as ConstraintKind)}
            value={constraintKind}
          >
            <option value="irmaaTier">IRMAA tier</option>
            <option value="acaFplPercentage">ACA FPL percentage</option>
            <option value="federalBracket">Federal bracket</option>
            <option value="ltcgBracket">LTCG bracket</option>
          </select>
        </label>
        <label className={labelClassName}>
          Max conversion per year
          <input
            className={formControlClassName({ className: 'mt-1 tabular-nums' })}
            inputMode="decimal"
            min="0"
            onChange={(event) => setMaxConversion(event.target.value)}
            placeholder="No cap"
            type="number"
            value={maxConversion}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {constraintKind === 'irmaaTier' ? (
          <label className={labelClassName}>
            Maximum IRMAA tier
            <select
              className={formControlClassName({ className: 'mt-1' })}
              onChange={(event) => setIrmaaTier(Number(event.target.value))}
              value={irmaaTier}
            >
              {irmaaTierOptions.map((tier) => (
                <option key={tier.index} value={tier.index}>
                  Tier {tier.index} up to {formatCurrency(tier.upperBound)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {constraintKind === 'acaFplPercentage' ? (
          <label className={labelClassName}>
            Maximum ACA FPL multiple
            <input
              className={formControlClassName({ className: 'mt-1 tabular-nums' })}
              inputMode="decimal"
              min="0"
              onChange={(event) => setAcaFplPercent(event.target.value)}
              step="0.1"
              type="number"
              value={acaFplPercent}
            />
          </label>
        ) : null}
        {constraintKind === 'federalBracket' ? (
          <RateSelect
            label="Federal bracket ceiling"
            onChange={setFederalBracketRate}
            rates={federalBracketRates}
            value={federalBracketRate}
          />
        ) : null}
        {constraintKind === 'ltcgBracket' ? (
          <RateSelect label="LTCG bracket ceiling" onChange={setLtcgBracketRate} rates={ltcgBracketRates} value={ltcgBracketRate} />
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className={messageClassName(message)}>
          {message}
        </div>
        <button className={primaryButtonClassName} onClick={generatePlan} type="button">
          Generate Roth ladder plan
        </button>
      </div>

      {years.length > 0 ? <RothOutputTable displayUnit={displayUnit} scenario={scenario} years={years} /> : null}
    </section>
  );
}

function RothOutputTable({
  displayUnit,
  scenario,
  years,
}: {
  displayUnit: DisplayUnit;
  scenario: Scenario;
  years: readonly RothLadderYearResult[];
}) {
  const conversionUnitLabel = displayUnit === 'real' ? "today's $" : 'nominal $';

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="min-w-[48rem] divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
          <tr>
            <th className="px-3 py-2" scope="col">
              Year
            </th>
            <th className="px-3 py-2" scope="col">
              Conversion ({conversionUnitLabel})
            </th>
            <th className="px-3 py-2" scope="col">
              Measured
            </th>
            <th className="px-3 py-2" scope="col">
              Margin
            </th>
            <th className="px-3 py-2" scope="col">
              IRMAA premium year
            </th>
            <th className="px-3 py-2" scope="col">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
          {years.map((year) => (
            <tr className="transition-colors hover:bg-slate-50/80 motion-reduce:transition-none dark:hover:bg-slate-900/50" key={year.year}>
              <th className="px-3 py-2 text-left font-medium tabular-nums text-slate-950 dark:text-slate-50" scope="row">
                {year.year}
              </th>
              <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">
                {formatDisplayCurrency(year.conversionAmount, year.year, scenario, displayUnit)}
              </td>
              <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">{formatCurrency(year.measuredValue)}</td>
              <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">
                {year.bindingMargin === null ? 'n/a' : formatCurrency(year.bindingMargin)}
              </td>
              <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">
                <span>{year.irmaaLookback.premiumYear}</span>
                <span className="block text-[0.65rem] leading-tight text-slate-500 dark:text-slate-400">
                  {year.irmaaLookback.note}
                </span>
              </td>
              <td className="px-3 py-2">
                <span className={statusBadgeClassName(year.status)}>{statusLabel(year.status)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <label className={labelClassName}>
      {label}
      <input
        className={formControlClassName({ className: 'mt-1 tabular-nums' })}
        inputMode="numeric"
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
    </label>
  );
}

function RateSelect({
  label,
  onChange,
  rates,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  rates: readonly number[];
  value: number;
}) {
  return (
    <label className={labelClassName}>
      {label}
      <select
        className={formControlClassName({ className: 'mt-1' })}
        onChange={(event) => onChange(Number(event.target.value))}
        value={value}
      >
        {rates.map((rate) => (
          <option key={rate} value={rate}>
            {formatPercent(rate)}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildRothLadderConstraint({
  acaFplPercent,
  constraintKind,
  federalBracketRate,
  federalBracketRates,
  irmaaTier,
  irmaaTierOptions,
  ltcgBracketRate,
  ltcgBracketRates,
}: {
  acaFplPercent: string;
  constraintKind: ConstraintKind;
  federalBracketRate: number;
  federalBracketRates: readonly number[];
  irmaaTier: number;
  irmaaTierOptions: readonly { index: number; upperBound: number }[];
  ltcgBracketRate: number;
  ltcgBracketRates: readonly number[];
}): RothLadderConstraint {
  switch (constraintKind) {
    case 'irmaaTier':
      return { kind: 'irmaaTier', maxTier: validOption(irmaaTierOptions.map((tier) => tier.index), irmaaTier) };
    case 'acaFplPercentage':
      return { kind: 'acaFplPercentage', maxFplPercent: parseOptionalMoney(acaFplPercent) ?? 0 };
    case 'federalBracket':
      return { kind: 'federalBracket', bracketRate: validOption(federalBracketRates, federalBracketRate) };
    case 'ltcgBracket':
      return { kind: 'ltcgBracket', bracketRate: validOption(ltcgBracketRates, ltcgBracketRate) };
  }
}

export function buildDefaultRothLadderConstraint(scenario: Scenario): RothLadderConstraint {
  const constants = effectiveConstants(scenario);
  const federalBracketRates = constants.federal.ordinaryBrackets[scenario.filingStatus]
    .slice(0, -1)
    .map((bracket) => bracket.rate);

  return { kind: 'federalBracket', bracketRate: defaultFederalBracketRate(federalBracketRates) };
}

export function defaultRothLadderPlannerRange(scenario: Scenario, plan: WithdrawalPlan): { startYear: number; endYear: number } {
  const startYear = scenario.startYear;
  const socialSecurityClaimYear = scenario.socialSecurity?.claimYear;
  const fallbackEndYear = Math.min(startYear + 10, plan.endYear);
  const endYear =
    socialSecurityClaimYear !== undefined && socialSecurityClaimYear >= startYear && socialSecurityClaimYear <= plan.endYear
      ? socialSecurityClaimYear
      : fallbackEndYear;

  return { startYear, endYear };
}

function defaultFederalBracketRate(federalBracketRates: readonly number[]): number {
  return federalBracketRates[1] ?? federalBracketRates[0] ?? 0;
}

function tierUpperBound(tier: object): number | null {
  if ('magiUpToInclusive' in tier && typeof tier.magiUpToInclusive === 'number') {
    return tier.magiUpToInclusive;
  }
  if ('magiLessThan' in tier && typeof tier.magiLessThan === 'number') {
    return tier.magiLessThan;
  }

  return null;
}

function parseOptionalMoney(value: string): number | undefined {
  const trimmed = value.trim().replaceAll(',', '');

  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function validOption(options: readonly number[], value: number): number {
  return options.includes(value) ? value : (options[0] ?? 0);
}

function clampYear(year: number, startYear: number, endYear: number): number {
  if (!Number.isFinite(year)) {
    return startYear;
  }

  return Math.max(startYear, Math.min(endYear, Math.trunc(year)));
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function formatDisplayCurrency(value: number, year: number, scenario: Scenario, displayUnit: DisplayUnit): string {
  const displayValue = displayUnit === 'real' ? toReal(value, year, scenario.startYear, scenario.inflationRate) : value;

  return formatCurrency(displayValue);
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function statusLabel(status: string): string {
  return status.replaceAll('-', ' ');
}

function messageClassName(message: string): string {
  return classNames(
    'min-h-5 text-sm',
    message.startsWith('Generated')
      ? 'text-emerald-700 dark:text-emerald-300'
      : message.length > 0
        ? 'text-red-700 dark:text-red-300'
        : 'text-slate-600 dark:text-slate-300',
  );
}

function statusBadgeClassName(status: RothLadderConstraintStatus): string {
  const tone =
    status === 'constraint-met'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200'
      : status === 'already-over-target'
        ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200'
        : status.startsWith('limited-by')
          ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100'
          : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';

  return classNames('inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', tone);
}
