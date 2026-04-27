import { useEffect, useMemo, useState } from 'react';

import { effectiveConstants } from '@/core/constants/customLaw';
import { generateLtcgHarvestPlan, type LtcgHarvestYearResult } from '@/core/planners/ltcgHarvester';
import type { Scenario, WithdrawalPlan } from '@/core/projection';
import { useScenarioStore } from '@/store/scenarioStore';

export function LtcgHarvesterUI() {
  const scenario = useScenarioStore((state) => state.scenario);
  const plan = useScenarioStore((state) => state.plan);
  const setPlan = useScenarioStore((state) => state.setPlan);
  const defaultRange = useMemo(
    () => defaultPlannerRange(scenario, plan),
    [plan.endYear, scenario.socialSecurity?.claimYear, scenario.startYear],
  );
  const irmaaTierOptions = effectiveConstants(scenario).irmaa.partBTiers[scenario.filingStatus]
    .map((tier, index) => ({ index, upperBound: tierUpperBound(tier) }))
    .filter((tier): tier is { index: number; upperBound: number } => tier.upperBound !== null);
  const [startYear, setStartYear] = useState(defaultRange.startYear);
  const [endYear, setEndYear] = useState(defaultRange.endYear);
  const [maxHarvest, setMaxHarvest] = useState('');
  const [remainingGainFloor, setRemainingGainFloor] = useState('');
  const [acaGuardEnabled, setAcaGuardEnabled] = useState(false);
  const [acaFplPercent, setAcaFplPercent] = useState('4');
  const [irmaaGuardEnabled, setIrmaaGuardEnabled] = useState(false);
  const [irmaaTier, setIrmaaTier] = useState(irmaaTierOptions[0]?.index ?? 0);
  const [years, setYears] = useState<readonly LtcgHarvestYearResult[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setStartYear(defaultRange.startYear);
    setEndYear(defaultRange.endYear);
  }, [defaultRange.startYear, defaultRange.endYear]);

  function generatePlan() {
    try {
      const parsedMaxHarvest = parseOptionalMoney(maxHarvest);
      const parsedRemainingGainFloor = parseOptionalMoney(remainingGainFloor);
      const result = generateLtcgHarvestPlan({
        scenario,
        basePlan: plan,
        startYear: clampYear(startYear, scenario.startYear, plan.endYear),
        endYear: clampYear(Math.max(startYear, endYear), scenario.startYear, plan.endYear),
        ...(parsedMaxHarvest !== undefined ? { maxHarvest: parsedMaxHarvest } : {}),
        ...(parsedRemainingGainFloor !== undefined ? { remainingUnrealizedGainFloor: parsedRemainingGainFloor } : {}),
        ...(acaGuardEnabled ? { acaGuard: { maxFplPercent: parseOptionalMoney(acaFplPercent) ?? 0 } } : {}),
        ...(irmaaGuardEnabled
          ? { irmaaGuard: { maxTier: validOption(irmaaTierOptions.map((tier) => tier.index), irmaaTier) } }
          : {}),
      });

      setPlan(result.plan);
      setYears(result.years);
      setMessage(`Generated LTCG harvest actions for ${result.years.length} years.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to generate LTCG harvest plan.');
    }
  }

  return (
    <section aria-labelledby="ltcg-harvester-heading" className="rounded-lg border border-slate-200 p-4">
      <div>
        <p className="text-sm font-medium text-indigo-700">0% LTCG harvester</p>
        <h3 className="mt-1 text-base font-semibold text-slate-900" id="ltcg-harvester-heading">
          Generate brokerage harvests
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Fill available long-term capital gain headroom while respecting optional caps and MAGI guards.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="LTCG start year" onChange={setStartYear} value={startYear} />
        <NumberField label="LTCG end year" onChange={setEndYear} value={endYear} />
        <label className="text-sm font-medium text-slate-800">
          Max harvest per year
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            inputMode="decimal"
            min="0"
            onChange={(event) => setMaxHarvest(event.target.value)}
            placeholder="No cap"
            type="number"
            value={maxHarvest}
          />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Remaining unrealized gain floor
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            inputMode="decimal"
            min="0"
            onChange={(event) => setRemainingGainFloor(event.target.value)}
            placeholder="No floor"
            type="number"
            value={remainingGainFloor}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input checked={acaGuardEnabled} onChange={(event) => setAcaGuardEnabled(event.target.checked)} type="checkbox" />
          Apply ACA FPL guard
        </label>
        {acaGuardEnabled ? (
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
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input checked={irmaaGuardEnabled} onChange={(event) => setIrmaaGuardEnabled(event.target.checked)} type="checkbox" />
          Apply IRMAA guard
        </label>
        {irmaaGuardEnabled ? (
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
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-h-5 text-sm text-slate-600">
          {message}
        </div>
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={generatePlan} type="button">
          Generate LTCG harvest plan
        </button>
      </div>

      {years.length > 0 ? <LtcgOutputTable years={years} /> : null}
    </section>
  );
}

function LtcgOutputTable({ years }: { years: readonly LtcgHarvestYearResult[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-3 py-2" scope="col">
              Year
            </th>
            <th className="px-3 py-2" scope="col">
              Harvest
            </th>
            <th className="px-3 py-2" scope="col">
              0% headroom
            </th>
            <th className="px-3 py-2" scope="col">
              ACA margin
            </th>
            <th className="px-3 py-2" scope="col">
              IRMAA margin
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
              <td className="px-3 py-2">{formatCurrency(year.harvestAmount)}</td>
              <td className="px-3 py-2">{formatCurrency(year.ltcg0PctHeadroom)}</td>
              <td className="px-3 py-2">{year.acaGuardMargin === null ? 'n/a' : formatCurrency(year.acaGuardMargin)}</td>
              <td className="px-3 py-2">{year.irmaaGuardMargin === null ? 'n/a' : formatCurrency(year.irmaaGuardMargin)}</td>
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

function statusLabel(status: string): string {
  return status.replaceAll('-', ' ');
}
