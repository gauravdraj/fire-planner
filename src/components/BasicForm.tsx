import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';

import type { FilingStatus } from '@/core/types';
import type { BasicFormValues, BasicHealthcarePhase, BasicStarterStateCode } from '@/lib/basicFormMapping';
import { useScenarioStore } from '@/store/scenarioStore';

type BasicFormDraft = {
  [Field in keyof BasicFormValues]: string;
};

type BasicFormErrors = Partial<Record<keyof BasicFormDraft, string>>;

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
  'traditionalBalance',
  'rothBalance',
  'brokerageAndCashBalance',
  'taxableBrokerageBasis',
  'annualW2Income',
  'annualConsultingIncome',
  'annualRentalIncome',
  'annualSocialSecurityBenefit',
  'annualPensionOrAnnuityIncome',
] as const;

export function BasicForm() {
  const formValues = useScenarioStore((state) => state.formValues);
  const replaceFormValues = useScenarioStore((state) => state.replaceFormValues);
  const [draft, setDraft] = useStateFromFormValues(formValues);
  const [errors, setErrors] = useStateFromErrors();
  const [statusMessage, setStatusMessage] = useStateFromStatusMessage();
  const showPartnerAge = draft.filingStatus === 'mfj';

  function updateField(field: keyof BasicFormDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatusMessage(null);
  }

  function handleSelectChange(field: keyof BasicFormDraft) {
    return (event: ChangeEvent<HTMLSelectElement>) => updateField(field, event.target.value);
  }

  function handleInputChange(field: keyof BasicFormDraft) {
    return (event: ChangeEvent<HTMLInputElement>) => updateField(field, event.target.value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = validateBasicFormDraft(draft);
    setErrors(result.errors);

    if (result.values === null) {
      setStatusMessage(null);
      return;
    }

    replaceFormValues(result.values);
    setStatusMessage('Scenario updated.');
  }

  return (
    <form aria-label="Basic scenario form" className="mt-6 grid gap-4 sm:grid-cols-2" noValidate onSubmit={handleSubmit}>
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
      {renderNumberField('retirementYear', 'Retirement target year', draft, errors, handleInputChange)}
      {renderNumberField('planEndAge', 'Plan-end age', draft, errors, handleInputChange)}
      {renderNumberField('annualSpendingToday', 'Annual spending', draft, errors, handleInputChange)}
      {renderNumberField('traditionalBalance', 'Traditional balance', draft, errors, handleInputChange)}
      {renderNumberField('rothBalance', 'Roth balance', draft, errors, handleInputChange)}
      {renderNumberField('brokerageAndCashBalance', 'Brokerage plus cash balance', draft, errors, handleInputChange)}
      {renderNumberField('taxableBrokerageBasis', 'Weighted-average taxable basis', draft, errors, handleInputChange)}
      {renderNumberField('annualW2Income', 'W-2 income', draft, errors, handleInputChange)}
      {renderNumberField('annualConsultingIncome', 'Net consulting income', draft, errors, handleInputChange)}
      {renderNumberField('annualRentalIncome', 'Net rental income', draft, errors, handleInputChange)}
      {renderNumberField(
        'annualSocialSecurityBenefit',
        'Social Security annual benefit',
        draft,
        errors,
        handleInputChange,
      )}
      {renderNumberField('socialSecurityClaimAge', 'Social Security claim age', draft, errors, handleInputChange)}
      {renderNumberField(
        'annualPensionOrAnnuityIncome',
        'Pension/annuity annual amount',
        draft,
        errors,
        handleInputChange,
      )}

      <Field error={errors.healthcarePhase} id="healthcarePhase" label="Healthcare phase">
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

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:col-span-2 sm:flex-row sm:items-center">
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          type="submit"
        >
          Run projection
        </button>
        {statusMessage === null ? null : (
          <p className="text-sm font-medium text-indigo-700" role="status">
            {statusMessage}
          </p>
        )}
      </div>
    </form>
  );
}

export function validateBasicFormDraft(draft: BasicFormDraft): ValidationResult {
  const errors: BasicFormErrors = {};
  const currentYear = parseIntegerField(draft, 'currentYear', errors, 'Current year');
  const primaryAge = parseIntegerField(draft, 'primaryAge', errors, 'Primary age');
  const partnerAge = draft.filingStatus === 'mfj' ? parseIntegerField(draft, 'partnerAge', errors, 'Partner age') : 0;
  const retirementYear = parseIntegerField(draft, 'retirementYear', errors, 'Retirement target year');
  const planEndAge = parseIntegerField(draft, 'planEndAge', errors, 'Plan-end age');
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

  if (primaryAge !== null && planEndAge !== null && planEndAge <= primaryAge) {
    setError(errors, 'planEndAge', 'Plan-end age must be greater than primary age.');
  }

  if (socialSecurityClaimAge !== null && (socialSecurityClaimAge < 62 || socialSecurityClaimAge > 70)) {
    setError(errors, 'socialSecurityClaimAge', 'Enter a claim age from 62 to 70.');
  }

  const moneyValues = Object.fromEntries(
    MONEY_FIELDS.map((field) => [field, parseMoneyField(draft, field, errors, moneyFieldLabel(field))]),
  ) as Record<(typeof MONEY_FIELDS)[number], number | null>;

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
      annualW2Income: moneyValues.annualW2Income ?? 0,
      annualConsultingIncome: moneyValues.annualConsultingIncome ?? 0,
      annualRentalIncome: moneyValues.annualRentalIncome ?? 0,
      annualSocialSecurityBenefit: moneyValues.annualSocialSecurityBenefit ?? 0,
      socialSecurityClaimAge: socialSecurityClaimAge ?? 0,
      annualPensionOrAnnuityIncome: moneyValues.annualPensionOrAnnuityIncome ?? 0,
      brokerageAndCashBalance: moneyValues.brokerageAndCashBalance ?? 0,
      taxableBrokerageBasis: moneyValues.taxableBrokerageBasis ?? 0,
      traditionalBalance: moneyValues.traditionalBalance ?? 0,
      rothBalance: moneyValues.rothBalance ?? 0,
      healthcarePhase: draft.healthcarePhase as BasicHealthcarePhase,
    },
  };
}

function Field({
  children,
  error,
  id,
  label,
}: {
  children: ReactNode;
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
      {error === undefined ? null : (
        <p className="text-sm text-red-700" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function renderNumberField(
  field: keyof BasicFormDraft,
  label: string,
  draft: BasicFormDraft,
  errors: BasicFormErrors,
  handleInputChange: (field: keyof BasicFormDraft) => (event: ChangeEvent<HTMLInputElement>) => void,
) {
  const error = errors[field];

  return (
    <Field error={error} id={field} key={field} label={label}>
      <input
        aria-describedby={error ? `${field}-error` : undefined}
        aria-invalid={error ? 'true' : undefined}
        className={inputClassName(error)}
        id={field}
        inputMode="decimal"
        onChange={handleInputChange(field)}
        type="number"
        value={draft[field]}
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
    case 'traditionalBalance':
      return 'Traditional balance';
    case 'rothBalance':
      return 'Roth balance';
    case 'brokerageAndCashBalance':
      return 'Brokerage plus cash balance';
    case 'taxableBrokerageBasis':
      return 'Weighted-average taxable basis';
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
    annualW2Income: String(values.annualW2Income),
    annualConsultingIncome: String(values.annualConsultingIncome),
    annualRentalIncome: String(values.annualRentalIncome),
    annualSocialSecurityBenefit: String(values.annualSocialSecurityBenefit),
    socialSecurityClaimAge: String(values.socialSecurityClaimAge),
    annualPensionOrAnnuityIncome: String(values.annualPensionOrAnnuityIncome),
    brokerageAndCashBalance: String(values.brokerageAndCashBalance),
    taxableBrokerageBasis: String(values.taxableBrokerageBasis),
    traditionalBalance: String(values.traditionalBalance),
    rothBalance: String(values.rothBalance),
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

function useStateFromErrors() {
  return useState<BasicFormErrors>({});
}

function useStateFromStatusMessage() {
  return useState<string | null>(null);
}
