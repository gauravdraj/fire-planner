import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';

import { deriveInputChips } from '@/core/derivedChips';
import type { FilingStatus } from '@/core/types';
import type { BasicFormValues, BasicHealthcarePhase, BasicStarterStateCode } from '@/lib/basicFormMapping';
import { basicFormSectionExplanations, type BasicFormSectionId } from '@/lib/columnExplanations';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { useScenarioStore } from '@/store/scenarioStore';

import { InfoTooltip } from './InfoTooltip';

type BasicFormDraft = {
  [Field in keyof BasicFormValues]: string;
};

type BasicFormErrors = Partial<Record<keyof BasicFormDraft, string>>;
type BasicFormTouched = Partial<Record<keyof BasicFormDraft, boolean>>;

type ValidationResult =
  | Readonly<{
      errors: BasicFormErrors;
      values: BasicFormValues;
    }>
  | Readonly<{
      errors: BasicFormErrors;
      values: null;
    }>;

const FILING_STATUS_OPTIONS: ReadonlyArray<{ label: string; value: FilingStatus }> = [
  { label: 'Single', value: 'single' },
  { label: 'Married filing jointly', value: 'mfj' },
  { label: 'Head of household', value: 'hoh' },
  { label: 'Married filing separately', value: 'mfs' },
];

const STATE_OPTIONS: ReadonlyArray<{ label: string; value: BasicStarterStateCode }> = [
  { label: 'California', value: 'CA' },
  { label: 'Florida', value: 'FL' },
  { label: 'Pennsylvania', value: 'PA' },
];

const HEALTHCARE_PHASE_OPTIONS: ReadonlyArray<{ label: string; value: BasicHealthcarePhase }> = [
  { label: 'None', value: 'none' },
  { label: 'ACA marketplace', value: 'aca' },
  { label: 'Medicare', value: 'medicare' },
];

const MONEY_FIELDS = [
  'annualSpendingToday',
  'annualMortgagePAndI',
  'traditionalBalance',
  'rothBalance',
  'brokerageAndCashBalance',
  'taxableBrokerageBasis',
  'hsaBalance',
  'annualW2Income',
  'annualConsultingIncome',
  'annualRentalIncome',
  'annualSocialSecurityBenefit',
  'annualPensionOrAnnuityIncome',
] as const;

const PERCENT_FIELDS = [
  'autoDepleteBrokerageAnnualScaleUpFactor',
  'expectedReturnTraditional',
  'expectedReturnRoth',
  'expectedReturnBrokerage',
  'expectedReturnHsa',
  'brokerageDividendYield',
  'brokerageQdiPercentage',
] as const;

const LIVE_UPDATE_DELAY_MS = 150;
const PLAN_END_AFTER_PRIMARY_AGE_ERROR = 'Plan-end age must be greater than primary age.';

export function BasicForm() {
  const formValues = useScenarioStore((state) => state.formValues);
  const scenario = useScenarioStore((state) => state.scenario);
  const projectionResults = useScenarioStore((state) => state.projectionResults);
  const setFormValues = useScenarioStore((state) => state.setFormValues);
  const [draft, setDraft] = useStateFromFormValues(formValues);
  const [touched, setTouched] = useStateFromTouched();
  const pendingPatchRef = useRef<Partial<BasicFormValues>>({});
  const validation = validateBasicFormDraft(draft);
  const errors = visibleErrors(validation.errors, touched);
  const showPartnerAge = draft.filingStatus === 'mfj';
  const chips = deriveInputChips({ formValues, projectionResults, scenario });
  const commitPendingPatch = useDebouncedCallback(() => {
    const patch = pendingPatchRef.current;

    pendingPatchRef.current = {};

    if (Object.keys(patch).length > 0) {
      setFormValues(patch);
    }
  }, LIVE_UPDATE_DELAY_MS);

  function updateField(field: keyof BasicFormDraft, value: string) {
    const nextDraft = { ...draft, [field]: value };
    const nextValidation = validateBasicFormDraft(nextDraft);
    const patch = createValidPatch(field, nextDraft, nextValidation.errors);

    setTouched((current) => ({ ...current, [field]: true }));
    setDraft(nextDraft);

    if (patch === null) {
      clearPendingField(field, nextValidation.errors);
    } else {
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    }

    commitPendingPatch();
  }

  function handleSelectChange(field: keyof BasicFormDraft) {
    return (event: ChangeEvent<HTMLSelectElement>) => updateField(field, event.target.value);
  }

  function handleInputChange(field: keyof BasicFormDraft) {
    return (event: ChangeEvent<HTMLInputElement>) => updateField(field, event.target.value);
  }

  function handleCheckboxChange(field: keyof BasicFormDraft) {
    return (event: ChangeEvent<HTMLInputElement>) => updateField(field, String(event.target.checked));
  }

  return (
    <div aria-label="Basic scenario form" className="mt-6 grid gap-4 sm:grid-cols-2" role="form">
      <SectionFieldset sectionId="household">
        <Field error={errors.filingStatus} id="filingStatus" label="Filing status">
          <select
            aria-describedby={errors.filingStatus ? 'filingStatus-error' : undefined}
            aria-invalid={errors.filingStatus ? 'true' : undefined}
            className={inputClassName(errors.filingStatus)}
            id="filingStatus"
            onChange={handleSelectChange('filingStatus')}
            value={draft.filingStatus}
          >
            {FILING_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field error={errors.stateCode} id="stateCode" label="State">
          <select
            aria-describedby={errors.stateCode ? 'stateCode-error' : undefined}
            aria-invalid={errors.stateCode ? 'true' : undefined}
            className={inputClassName(errors.stateCode)}
            id="stateCode"
            onChange={handleSelectChange('stateCode')}
            value={draft.stateCode}
          >
            {STATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {renderNumberField('primaryAge', 'Primary age', draft, errors, handleInputChange)}
        {showPartnerAge ? renderNumberField('partnerAge', 'Partner age', draft, errors, handleInputChange) : null}
      </SectionFieldset>

      <SectionFieldset sectionId="timeline">
        {renderNumberField('currentYear', 'Current year', draft, errors, handleInputChange)}
        {renderNumberField(
          'retirementYear',
          'Retirement target year',
          draft,
          errors,
          handleInputChange,
          chips.retirementTarget,
        )}
        {renderNumberField('planEndAge', 'Plan-end age', draft, errors, handleInputChange)}
        {renderNumberField('socialSecurityClaimAge', 'Social Security claim age', draft, errors, handleInputChange)}
      </SectionFieldset>

      <SectionFieldset sectionId="spending">
        {renderNumberField(
          'annualSpendingToday',
          'Annual spending',
          draft,
          errors,
          handleInputChange,
          chips.annualSpending,
        )}
        {renderNumberField(
          'annualMortgagePAndI',
          'Annual mortgage P&I',
          draft,
          errors,
          handleInputChange,
          chips.mortgagePAndI,
        )}
        {renderNumberField('mortgagePayoffYear', 'Mortgage payoff year', draft, errors, handleInputChange)}
      </SectionFieldset>

      <SectionFieldset sectionId="balances">
        {renderNumberField('traditionalBalance', 'Traditional balance', draft, errors, handleInputChange)}
        {renderNumberField('rothBalance', 'Roth balance', draft, errors, handleInputChange)}
        {renderNumberField(
          'brokerageAndCashBalance',
          'Brokerage plus cash balance',
          draft,
          errors,
          handleInputChange,
          chips.brokeragePlusCash,
        )}
        {renderNumberField(
          'taxableBrokerageBasis',
          'Weighted-average taxable basis',
          draft,
          errors,
          handleInputChange,
        )}
        {renderNumberField('hsaBalance', 'HSA balance', draft, errors, handleInputChange)}
      </SectionFieldset>

      <SectionFieldset sectionId="growthDividends">
        <p className="sm:col-span-2 text-sm text-slate-600">
          Expected returns are annual decimals for each modeled account bucket. Brokerage expected return is price
          appreciation when dividend yield is modeled; price return plus after-tax reinvested dividends make up modeled
          brokerage growth.
        </p>
        {renderNumberField('expectedReturnTraditional', 'Traditional expected return', draft, errors, handleInputChange)}
        {renderNumberField('expectedReturnRoth', 'Roth expected return', draft, errors, handleInputChange)}
        {renderNumberField('expectedReturnBrokerage', 'Brokerage expected return', draft, errors, handleInputChange)}
        {renderNumberField('expectedReturnHsa', 'HSA expected return', draft, errors, handleInputChange)}
        {renderNumberField('brokerageDividendYield', 'Brokerage dividend yield', draft, errors, handleInputChange)}
        {renderNumberField('brokerageQdiPercentage', 'Qualified dividend percentage', draft, errors, handleInputChange)}
      </SectionFieldset>

      <SectionFieldset sectionId="withdrawalStrategy">
        {renderCheckboxField(
          'autoDepleteBrokerageEnabled',
          'Auto-deplete brokerage',
          draft,
          errors,
          handleCheckboxChange,
        )}
        {renderNumberField(
          'autoDepleteBrokerageYears',
          'Brokerage depletion years',
          draft,
          errors,
          handleInputChange,
        )}
        {renderNumberField(
          'autoDepleteBrokerageAnnualScaleUpFactor',
          'Brokerage annual scale-up factor',
          draft,
          errors,
          handleInputChange,
        )}
      </SectionFieldset>

      <SectionFieldset sectionId="income">
        {renderNumberField('annualW2Income', 'W-2 income', draft, errors, handleInputChange, chips.w2Income)}
        {renderNumberField('annualConsultingIncome', 'Net consulting income', draft, errors, handleInputChange)}
        {renderNumberField('annualRentalIncome', 'Net rental income', draft, errors, handleInputChange)}
        {renderNumberField(
          'annualSocialSecurityBenefit',
          'Social Security annual benefit',
          draft,
          errors,
          handleInputChange,
          chips.socialSecurity,
        )}
        {renderNumberField(
          'annualPensionOrAnnuityIncome',
          'Pension/annuity annual amount',
          draft,
          errors,
          handleInputChange,
        )}
      </SectionFieldset>

      <SectionFieldset sectionId="healthcare">
        <Field error={errors.healthcarePhase} id="healthcarePhase" label="Healthcare phase" chip={chips.healthcare}>
          <select
            aria-describedby={errors.healthcarePhase ? 'healthcarePhase-error' : undefined}
            aria-invalid={errors.healthcarePhase ? 'true' : undefined}
            className={inputClassName(errors.healthcarePhase)}
            id="healthcarePhase"
            onChange={handleSelectChange('healthcarePhase')}
            value={draft.healthcarePhase}
          >
            {HEALTHCARE_PHASE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </SectionFieldset>
    </div>
  );

  function clearPendingField(field: keyof BasicFormDraft, errors: BasicFormErrors) {
    const { [field]: _ignoredField, ...withoutField } = pendingPatchRef.current;

    pendingPatchRef.current = withoutField;

    if ((field === 'primaryAge' || field === 'planEndAge') && errors.planEndAge === PLAN_END_AFTER_PRIMARY_AGE_ERROR) {
      const { primaryAge: _ignoredPrimaryAge, planEndAge: _ignoredPlanEndAge, ...withoutAgePair } = pendingPatchRef.current;

      pendingPatchRef.current = withoutAgePair;
    }
  }
}

export function validateBasicFormDraft(draft: BasicFormDraft): ValidationResult {
  const errors: BasicFormErrors = {};
  const currentYear = parseIntegerField(draft, 'currentYear', errors, 'Current year');
  const primaryAge = parseIntegerField(draft, 'primaryAge', errors, 'Primary age');
  const partnerAge = draft.filingStatus === 'mfj' ? parseIntegerField(draft, 'partnerAge', errors, 'Partner age') : 0;
  const retirementYear = parseIntegerField(draft, 'retirementYear', errors, 'Retirement target year');
  const planEndAge = parseIntegerField(draft, 'planEndAge', errors, 'Plan-end age');
  const mortgagePayoffYear = parseIntegerField(draft, 'mortgagePayoffYear', errors, 'Mortgage payoff year');
  const autoDepleteBrokerageEnabled = parseBooleanField(
    draft,
    'autoDepleteBrokerageEnabled',
    errors,
    'Auto-deplete brokerage',
  );
  const autoDepleteBrokerageYears = parseIntegerField(
    draft,
    'autoDepleteBrokerageYears',
    errors,
    'Brokerage depletion years',
  );
  const socialSecurityClaimAge = parseIntegerField(draft, 'socialSecurityClaimAge', errors, 'Social Security claim age');

  if (!isFilingStatus(draft.filingStatus)) {
    setError(errors, 'filingStatus', 'Choose a filing status.');
  }

  if (!isStarterStateCode(draft.stateCode)) {
    setError(errors, 'stateCode', 'Choose a starter state.');
  }

  if (!isHealthcarePhase(draft.healthcarePhase)) {
    setError(errors, 'healthcarePhase', 'Choose a healthcare phase.');
  }

  if (primaryAge !== null && (primaryAge < 18 || primaryAge > 110)) {
    setError(errors, 'primaryAge', 'Enter an age from 18 to 110.');
  }

  if (draft.filingStatus === 'mfj' && partnerAge !== null && (partnerAge < 18 || partnerAge > 110)) {
    setError(errors, 'partnerAge', 'Enter an age from 18 to 110.');
  }

  if (planEndAge !== null && (planEndAge < 18 || planEndAge > 110)) {
    setError(errors, 'planEndAge', 'Enter an age from 18 to 110.');
  }

  if (currentYear !== null && retirementYear !== null && retirementYear < currentYear) {
    setError(errors, 'retirementYear', `Enter ${currentYear} or later.`);
  }

  if (mortgagePayoffYear !== null && mortgagePayoffYear !== 0) {
    if (mortgagePayoffYear < 0) {
      setError(errors, 'mortgagePayoffYear', 'Enter 0 or a future payoff year.');
    } else if (currentYear !== null && mortgagePayoffYear < currentYear) {
      setError(errors, 'mortgagePayoffYear', `Enter 0 or ${currentYear} or later.`);
    }
  }

  if (autoDepleteBrokerageYears !== null && (autoDepleteBrokerageYears < 1 || autoDepleteBrokerageYears > 120)) {
    setError(errors, 'autoDepleteBrokerageYears', 'Enter 1 to 120 depletion years.');
  }

  if (primaryAge !== null && planEndAge !== null && planEndAge <= primaryAge) {
    setError(errors, 'planEndAge', PLAN_END_AFTER_PRIMARY_AGE_ERROR);
  }

  if (socialSecurityClaimAge !== null && (socialSecurityClaimAge < 62 || socialSecurityClaimAge > 70)) {
    setError(errors, 'socialSecurityClaimAge', 'Enter a claim age from 62 to 70.');
  }

  const moneyValues = Object.fromEntries(
    MONEY_FIELDS.map((field) => [field, parseMoneyField(draft, field, errors, moneyFieldLabel(field))]),
  ) as Record<(typeof MONEY_FIELDS)[number], number | null>;
  const percentValues = Object.fromEntries(
    PERCENT_FIELDS.map((field) => [field, parsePercentageField(draft, field, errors, percentageFieldLabel(field))]),
  ) as Record<(typeof PERCENT_FIELDS)[number], number | null>;

  if (Object.keys(errors).length > 0) {
    return { errors, values: null };
  }

  return {
    errors,
    values: {
      currentYear: currentYear ?? 0,
      filingStatus: draft.filingStatus as FilingStatus,
      stateCode: draft.stateCode as BasicStarterStateCode,
      primaryAge: primaryAge ?? 0,
      partnerAge: draft.filingStatus === 'mfj' ? (partnerAge ?? 0) : 0,
      retirementYear: retirementYear ?? 0,
      planEndAge: planEndAge ?? 0,
      annualSpendingToday: moneyValues.annualSpendingToday ?? 0,
      annualMortgagePAndI: moneyValues.annualMortgagePAndI ?? 0,
      mortgagePayoffYear: mortgagePayoffYear ?? 0,
      annualW2Income: moneyValues.annualW2Income ?? 0,
      annualConsultingIncome: moneyValues.annualConsultingIncome ?? 0,
      annualRentalIncome: moneyValues.annualRentalIncome ?? 0,
      annualSocialSecurityBenefit: moneyValues.annualSocialSecurityBenefit ?? 0,
      socialSecurityClaimAge: socialSecurityClaimAge ?? 0,
      annualPensionOrAnnuityIncome: moneyValues.annualPensionOrAnnuityIncome ?? 0,
      brokerageAndCashBalance: moneyValues.brokerageAndCashBalance ?? 0,
      taxableBrokerageBasis: moneyValues.taxableBrokerageBasis ?? 0,
      hsaBalance: moneyValues.hsaBalance ?? 0,
      traditionalBalance: moneyValues.traditionalBalance ?? 0,
      rothBalance: moneyValues.rothBalance ?? 0,
      autoDepleteBrokerageEnabled: autoDepleteBrokerageEnabled ?? false,
      autoDepleteBrokerageYears: autoDepleteBrokerageYears ?? 0,
      autoDepleteBrokerageAnnualScaleUpFactor: percentValues.autoDepleteBrokerageAnnualScaleUpFactor ?? 0,
      expectedReturnTraditional: percentValues.expectedReturnTraditional ?? 0,
      expectedReturnRoth: percentValues.expectedReturnRoth ?? 0,
      expectedReturnBrokerage: percentValues.expectedReturnBrokerage ?? 0,
      expectedReturnHsa: percentValues.expectedReturnHsa ?? 0,
      brokerageDividendYield: percentValues.brokerageDividendYield ?? 0,
      brokerageQdiPercentage: percentValues.brokerageQdiPercentage ?? 0,
      healthcarePhase: draft.healthcarePhase as BasicHealthcarePhase,
    },
  };
}

function SectionFieldset({
  children,
  sectionId,
}: {
  children: ReactNode;
  sectionId: BasicFormSectionId;
}) {
  const explanation = basicFormSectionExplanations[sectionId];
  const label = explanation.label;

  return (
    <fieldset className="rounded-md border border-slate-200 p-4 sm:col-span-2">
      <legend className="px-2 text-sm font-semibold text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          {label}
          <InfoTooltip ariaLabel={`About ${label}`}>{explanation.description}</InfoTooltip>
        </span>
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  children,
  chip,
  error,
  id,
  label,
}: {
  children: ReactNode;
  chip?: string | undefined;
  error: string | undefined;
  id: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-800" htmlFor={id}>
        {label}
      </label>
      {children}
      {chip === undefined ? null : <DerivedChip>{chip}</DerivedChip>}
      {error === undefined ? null : (
        <p className="text-sm text-red-700" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function DerivedChip({ children }: { children: string }) {
  return <p className="text-xs font-medium uppercase tracking-wide text-slate-500">→ {children}</p>;
}

function visibleErrors(errors: BasicFormErrors, touched: BasicFormTouched): BasicFormErrors {
  const visible: BasicFormErrors = {};
  const fields = Object.keys(errors) as Array<keyof BasicFormDraft>;

  for (const field of fields) {
    const error = errors[field];

    if (error !== undefined && shouldShowError(field, error, touched)) {
      visible[field] = error;
    }
  }

  return visible;
}

function shouldShowError(field: keyof BasicFormDraft, error: string, touched: BasicFormTouched): boolean {
  if (field === 'planEndAge' && error === PLAN_END_AFTER_PRIMARY_AGE_ERROR) {
    return touched.primaryAge === true && touched.planEndAge === true;
  }

  return touched[field] === true;
}

function createValidPatch(
  field: keyof BasicFormDraft,
  draft: BasicFormDraft,
  errors: BasicFormErrors,
): Partial<BasicFormValues> | null {
  if (!canWriteField(field, errors)) {
    return null;
  }

  switch (field) {
    case 'currentYear':
      return parseIntegerPatch(draft, field, 'Current year');
    case 'primaryAge':
      return parseIntegerPatch(draft, field, 'Primary age');
    case 'partnerAge':
      return parseIntegerPatch(draft, field, 'Partner age');
    case 'retirementYear':
      return parseIntegerPatch(draft, field, 'Retirement target year');
    case 'planEndAge':
      return parseIntegerPatch(draft, field, 'Plan-end age');
    case 'mortgagePayoffYear':
      return parseIntegerPatch(draft, field, 'Mortgage payoff year');
    case 'autoDepleteBrokerageYears':
      return parseIntegerPatch(draft, field, 'Brokerage depletion years');
    case 'socialSecurityClaimAge':
      return parseIntegerPatch(draft, field, 'Social Security claim age');
    case 'annualSpendingToday':
    case 'annualMortgagePAndI':
    case 'traditionalBalance':
    case 'rothBalance':
    case 'brokerageAndCashBalance':
    case 'taxableBrokerageBasis':
    case 'hsaBalance':
    case 'annualW2Income':
    case 'annualConsultingIncome':
    case 'annualRentalIncome':
    case 'annualSocialSecurityBenefit':
    case 'annualPensionOrAnnuityIncome':
      return parseMoneyPatch(draft, field);
    case 'autoDepleteBrokerageAnnualScaleUpFactor':
    case 'expectedReturnTraditional':
    case 'expectedReturnRoth':
    case 'expectedReturnBrokerage':
    case 'expectedReturnHsa':
    case 'brokerageDividendYield':
    case 'brokerageQdiPercentage':
      return parsePercentagePatch(draft, field);
    case 'filingStatus':
      return isFilingStatus(draft.filingStatus) ? { filingStatus: draft.filingStatus } : null;
    case 'stateCode':
      return isStarterStateCode(draft.stateCode) ? { stateCode: draft.stateCode } : null;
    case 'healthcarePhase':
      return isHealthcarePhase(draft.healthcarePhase) ? { healthcarePhase: draft.healthcarePhase } : null;
    case 'autoDepleteBrokerageEnabled':
      return parseBooleanPatch(draft, field, 'Auto-deplete brokerage');
  }
}

function canWriteField(field: keyof BasicFormDraft, errors: BasicFormErrors): boolean {
  if (errors[field] !== undefined) {
    return false;
  }

  if ((field === 'primaryAge' || field === 'planEndAge') && errors.planEndAge === PLAN_END_AFTER_PRIMARY_AGE_ERROR) {
    return false;
  }

  return true;
}

function parseIntegerPatch(
  draft: BasicFormDraft,
  field: keyof BasicFormDraft,
  label: string,
): Partial<BasicFormValues> | null {
  const errors: BasicFormErrors = {};
  const value = parseIntegerField(draft, field, errors, label);

  if (value === null || errors[field] !== undefined) {
    return null;
  }

  return { [field]: value } as Partial<BasicFormValues>;
}

function parseMoneyPatch(
  draft: BasicFormDraft,
  field: (typeof MONEY_FIELDS)[number],
): Partial<BasicFormValues> | null {
  const errors: BasicFormErrors = {};
  const value = parseMoneyField(draft, field, errors, moneyFieldLabel(field));

  if (value === null || errors[field] !== undefined) {
    return null;
  }

  return { [field]: value } as Partial<BasicFormValues>;
}

function parseBooleanPatch(
  draft: BasicFormDraft,
  field: keyof BasicFormDraft,
  label: string,
): Partial<BasicFormValues> | null {
  const errors: BasicFormErrors = {};
  const value = parseBooleanField(draft, field, errors, label);

  if (value === null || errors[field] !== undefined) {
    return null;
  }

  return { [field]: value } as Partial<BasicFormValues>;
}

function parsePercentagePatch(
  draft: BasicFormDraft,
  field: (typeof PERCENT_FIELDS)[number],
): Partial<BasicFormValues> | null {
  const errors: BasicFormErrors = {};
  const value = parsePercentageField(draft, field, errors, percentageFieldLabel(field));

  if (value === null || errors[field] !== undefined) {
    return null;
  }

  return { [field]: value } as Partial<BasicFormValues>;
}

function renderNumberField(
  field: keyof BasicFormDraft,
  label: string,
  draft: BasicFormDraft,
  errors: BasicFormErrors,
  handleInputChange: (field: keyof BasicFormDraft) => (event: ChangeEvent<HTMLInputElement>) => void,
  chip?: string | undefined,
) {
  const error = errors[field];

  return (
    <Field chip={chip} error={error} id={field} key={field} label={label}>
      <input
        aria-describedby={error ? `${field}-error` : undefined}
        aria-invalid={error ? 'true' : undefined}
        className={inputClassName(error)}
        id={field}
        inputMode="decimal"
        onChange={handleInputChange(field)}
        type="text"
        value={draft[field]}
      />
    </Field>
  );
}

function renderCheckboxField(
  field: keyof BasicFormDraft,
  label: string,
  draft: BasicFormDraft,
  errors: BasicFormErrors,
  handleCheckboxChange: (field: keyof BasicFormDraft) => (event: ChangeEvent<HTMLInputElement>) => void,
) {
  const error = errors[field];

  return (
    <Field error={error} id={field} key={field} label={label}>
      <input
        aria-describedby={error ? `${field}-error` : undefined}
        aria-invalid={error ? 'true' : undefined}
        checked={draft[field] === 'true'}
        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
        id={field}
        onChange={handleCheckboxChange(field)}
        type="checkbox"
      />
    </Field>
  );
}

function inputClassName(error: string | undefined): string {
  return `w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 ${
    error === undefined ? 'border-slate-300' : 'border-red-600'
  }`;
}

function parseIntegerField(
  draft: BasicFormDraft,
  field: keyof BasicFormDraft,
  errors: BasicFormErrors,
  label: string,
): number | null {
  const value = parseRequiredNumber(draft[field], errors, field, label);

  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value)) {
    setError(errors, field, `${label} must be a whole number.`);
    return null;
  }

  return value;
}

function parseMoneyField(
  draft: BasicFormDraft,
  field: (typeof MONEY_FIELDS)[number],
  errors: BasicFormErrors,
  label: string,
): number | null {
  const value = parseRequiredNumber(draft[field], errors, field, label);

  if (value === null) {
    return null;
  }

  if (value < 0) {
    setError(errors, field, `${label} must be zero or greater.`);
    return null;
  }

  return value;
}

function parseBooleanField(
  draft: BasicFormDraft,
  field: keyof BasicFormDraft,
  errors: BasicFormErrors,
  label: string,
): boolean | null {
  if (draft[field] === 'true') {
    return true;
  }
  if (draft[field] === 'false') {
    return false;
  }

  setError(errors, field, `${label} must be checked or unchecked.`);
  return null;
}

function parsePercentageField(
  draft: BasicFormDraft,
  field: (typeof PERCENT_FIELDS)[number],
  errors: BasicFormErrors,
  label: string,
): number | null {
  const value = parseRequiredNumber(draft[field], errors, field, label);

  if (value === null) {
    return null;
  }

  if (value < 0 || value > 1) {
    setError(errors, field, `${label} must be between 0 and 1.`);
    return null;
  }

  return value;
}

function parseRequiredNumber(
  rawValue: string,
  errors: BasicFormErrors,
  field: keyof BasicFormDraft,
  label: string,
): number | null {
  if (rawValue.trim() === '') {
    setError(errors, field, `${label} is required.`);
    return null;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    setError(errors, field, `${label} must be a number.`);
    return null;
  }

  return value;
}

function setError(errors: BasicFormErrors, field: keyof BasicFormDraft, message: string) {
  errors[field] ??= message;
}

function moneyFieldLabel(field: (typeof MONEY_FIELDS)[number]): string {
  switch (field) {
    case 'annualSpendingToday':
      return 'Annual spending';
    case 'annualMortgagePAndI':
      return 'Annual mortgage P&I';
    case 'traditionalBalance':
      return 'Traditional balance';
    case 'rothBalance':
      return 'Roth balance';
    case 'brokerageAndCashBalance':
      return 'Brokerage plus cash balance';
    case 'taxableBrokerageBasis':
      return 'Weighted-average taxable basis';
    case 'hsaBalance':
      return 'HSA balance';
    case 'annualW2Income':
      return 'W-2 income';
    case 'annualConsultingIncome':
      return 'Net consulting income';
    case 'annualRentalIncome':
      return 'Net rental income';
    case 'annualSocialSecurityBenefit':
      return 'Social Security annual benefit';
    case 'annualPensionOrAnnuityIncome':
      return 'Pension/annuity annual amount';
  }
}

function percentageFieldLabel(field: (typeof PERCENT_FIELDS)[number]): string {
  switch (field) {
    case 'autoDepleteBrokerageAnnualScaleUpFactor':
      return 'Brokerage annual scale-up factor';
    case 'expectedReturnTraditional':
      return 'Traditional expected return';
    case 'expectedReturnRoth':
      return 'Roth expected return';
    case 'expectedReturnBrokerage':
      return 'Brokerage expected return';
    case 'expectedReturnHsa':
      return 'HSA expected return';
    case 'brokerageDividendYield':
      return 'Brokerage dividend yield';
    case 'brokerageQdiPercentage':
      return 'Qualified dividend percentage';
  }
}

function createDraft(values: BasicFormValues): BasicFormDraft {
  return {
    currentYear: String(values.currentYear),
    filingStatus: values.filingStatus,
    stateCode: values.stateCode,
    primaryAge: String(values.primaryAge),
    partnerAge: String(values.partnerAge),
    retirementYear: String(values.retirementYear),
    planEndAge: String(values.planEndAge),
    annualSpendingToday: String(values.annualSpendingToday),
    annualMortgagePAndI: String(values.annualMortgagePAndI),
    mortgagePayoffYear: String(values.mortgagePayoffYear),
    annualW2Income: String(values.annualW2Income),
    annualConsultingIncome: String(values.annualConsultingIncome),
    annualRentalIncome: String(values.annualRentalIncome),
    annualSocialSecurityBenefit: String(values.annualSocialSecurityBenefit),
    socialSecurityClaimAge: String(values.socialSecurityClaimAge),
    annualPensionOrAnnuityIncome: String(values.annualPensionOrAnnuityIncome),
    brokerageAndCashBalance: String(values.brokerageAndCashBalance),
    taxableBrokerageBasis: String(values.taxableBrokerageBasis),
    hsaBalance: String(values.hsaBalance),
    traditionalBalance: String(values.traditionalBalance),
    rothBalance: String(values.rothBalance),
    autoDepleteBrokerageEnabled: String(values.autoDepleteBrokerageEnabled),
    autoDepleteBrokerageYears: String(values.autoDepleteBrokerageYears),
    autoDepleteBrokerageAnnualScaleUpFactor: String(values.autoDepleteBrokerageAnnualScaleUpFactor),
    expectedReturnTraditional: String(values.expectedReturnTraditional),
    expectedReturnRoth: String(values.expectedReturnRoth),
    expectedReturnBrokerage: String(values.expectedReturnBrokerage),
    expectedReturnHsa: String(values.expectedReturnHsa),
    brokerageDividendYield: String(values.brokerageDividendYield),
    brokerageQdiPercentage: String(values.brokerageQdiPercentage),
    healthcarePhase: values.healthcarePhase,
  };
}

function isFilingStatus(value: string): value is FilingStatus {
  return value === 'single' || value === 'mfj' || value === 'hoh' || value === 'mfs';
}

function isStarterStateCode(value: string): value is BasicStarterStateCode {
  return value === 'CA' || value === 'FL' || value === 'PA';
}

function isHealthcarePhase(value: string): value is BasicHealthcarePhase {
  return value === 'none' || value === 'aca' || value === 'medicare';
}

function useStateFromFormValues(values: BasicFormValues) {
  return useState(createDraft(values));
}

function useStateFromTouched() {
  return useState<BasicFormTouched>({});
}
