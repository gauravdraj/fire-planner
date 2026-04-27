import { useEffect, useMemo, useState } from 'react';

import { effectiveConstants } from '@/core/constants/customLaw';
import {
  generateRothLadderPlan,
  type RothLadderConstraint,
  type RothLadderYearResult,
} from '@/core/planners/rothLadderTargeter';
import type { Scenario, WithdrawalPlan } from '@/core/projection';
import { useScenarioStore } from '@/store/scenarioStore';

type ConstraintKind = RothLadderConstraint['kind'];

export function RothLadderUI() {
  const scenario = useScenarioStore((state) => state.scenario);
  const plan = useScenarioStore((state) => state.plan);
  const setPlan = useScenarioStore((state) => state.setPlan);
  const defaultRange = useMemo(
    () => defaultPlannerRange(scenario, plan),
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
  const [federalBracketRate, setFederalBracketRate] = useState(federalBracketRates[1] ?? federalBracketRates[0] ?? 0);
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
        constraint: buildConstraint({
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
    <section aria-labelledby="roth-ladder-heading" className="rounded-lg border border-slate-200 p-4">
      <div>
        <p className="text-sm font-medium text-indigo-700">Roth ladder targeter</p>
        <h3 className="mt-1 text-base font-semibold text-slate-900" id="roth-ladder-heading">
          Generate Roth conversions
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Pick one binding constraint and write annual Roth conversion actions into the manual plan.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          <span title="Year T IRMAA MAGI drives the year T+2 Medicare premium bill.">IRMAA T+2:</span> Roth planner
          results show the later premium year affected by each conversion year.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="Roth start year" onChange={setStartYear} value={startYear} />
        <NumberField label="Roth end year" onChange={setEndYear} value={endYear} />
        <label className="text-sm font-medium text-slate-800">
          Binding constraint
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setConstraintKind(event.target.value as ConstraintKind)}
            value={constraintKind}
          >
            <option value="irmaaTier">IRMAA tier</option>
            <option value="acaFplPercentage">ACA FPL percentage</option>
            <option value="federalBracket">Federal bracket</option>
            <option value="ltcgBracket">LTCG bracket</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800">
          Max conversion per year
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          <label className="text-sm font-medium text-slate-800">
            Maximum IRMAA tier
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          <label className="text-sm font-medium text-slate-800">
            Maximum ACA FPL multiple
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
        <div aria-live="polite" className="min-h-5 text-sm text-slate-600">
          {message}
        </div>
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={generatePlan} type="button">
          Generate Roth ladder plan
        </button>
      </div>

      {years.length > 0 ? <RothOutputTable years={years} /> : null}
    </section>
  );
}

function RothOutputTable({ years }: { years: readonly RothLadderYearResult[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-3 py-2" scope="col">
              Year
            </th>
            <th className="px-3 py-2" scope="col">
              Conversion
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
        <tbody className="divide-y divide-slate-100 bg-white">
          {years.map((year) => (
            <tr key={year.year}>
              <th className="px-3 py-2 text-left font-medium text-slate-900" scope="row">
                {year.year}
              </th>
              <td className="px-3 py-2">{formatCurrency(year.conversionAmount)}</td>
              <td className="px-3 py-2">{formatCurrency(year.measuredValue)}</td>
              <td className="px-3 py-2">{year.bindingMargin === null ? 'n/a' : formatCurrency(year.bindingMargin)}</td>
              <td className="px-3 py-2" title={year.irmaaLookback.note}>
                {year.irmaaLookback.premiumYear}
              </td>
              <td className="px-3 py-2">{statusLabel(year.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
    <label className="text-sm font-medium text-slate-800">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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

function buildConstraint({
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

function defaultPlannerRange(scenario: Scenario, plan: WithdrawalPlan): { startYear: number; endYear: number } {
  const startYear = scenario.startYear;
  const socialSecurityClaimYear = scenario.socialSecurity?.claimYear;
  const fallbackEndYear = Math.min(startYear + 10, plan.endYear);
  const endYear =
    socialSecurityClaimYear !== undefined && socialSecurityClaimYear >= startYear && socialSecurityClaimYear <= plan.endYear
      ? socialSecurityClaimYear
      : fallbackEndYear;

  return { startYear, endYear };
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

function formatPercent(rate: number): string {
  return `${(rate * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function statusLabel(status: string): string {
  return status.replaceAll('-', ' ');
}
