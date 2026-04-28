import { describe, expect, it } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import type { CustomLaw } from '@/core/constants/customLaw';
import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { buildScenarioJsonExport, type ScenarioJsonExport } from '@/lib/jsonExport';
import { decodeScenario, encodeScenario } from '@/lib/urlHash';

import packageJson from '../../package.json';

const BASIC_FORM_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'mfj',
  stateCode: 'FL',
  primaryAge: 60,
  partnerAge: 60,
  retirementYear: 2028,
  planEndAge: 90,
  annualSpendingToday: 110_000,
  annualMortgagePAndI: 0,
  mortgagePayoffYear: 0,
  annualW2Income: 180_000,
  annualConsultingIncome: 0,
  annualRentalIncome: 0,
  annualSocialSecurityBenefit: 42_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 0,
  brokerageAndCashBalance: 600_000,
  taxableBrokerageBasis: 400_000,
  hsaBalance: 25_000,
  traditionalBalance: 900_000,
  rothBalance: 200_000,
  autoDepleteBrokerageEnabled: false,
  autoDepleteBrokerageYears: 10,
  autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
  expectedReturnTraditional: 0.05,
  expectedReturnRoth: 0.05,
  expectedReturnBrokerage: 0.05,
  expectedReturnHsa: 0.05,
  brokerageDividendYield: 0,
  brokerageQdiPercentage: 0.95,
  healthcarePhase: 'aca',
};

const GENERATED_AT = '2026-04-27T18:50:00.000Z';

function parseScenarioJsonExport(customLaw?: CustomLaw, customLawActive = customLaw !== undefined): ScenarioJsonExport {
  const { scenario, plan } = mapBasicFormToProjectionInputs(BASIC_FORM_VALUES);
  const json = buildScenarioJsonExport(BASIC_FORM_VALUES, scenario, plan, customLaw, customLawActive, GENERATED_AT);

  expect(json).toContain('\n  "metadata": {');
  expect(() => JSON.parse(json)).not.toThrow();

  return JSON.parse(json) as ScenarioJsonExport;
}

describe('buildScenarioJsonExport', () => {
  it('returns pretty-printed JSON with export metadata from existing app and constants sources', () => {
    const parsed = parseScenarioJsonExport();

    expect(parsed.metadata).toEqual({
      appVersion: packageJson.version,
      constantsRetrievedAt: CONSTANTS_2026.retrievedAt,
      generatedAt: GENERATED_AT,
      canonicalScenarioFormat: 'urlHash:v1',
    });
    expect(parsed.canonicalScenarioHash).toMatch(/^v1:/);
  });

  it('includes form values, scenario data, projection inputs, and withdrawal plan data', () => {
    const { scenario, plan } = mapBasicFormToProjectionInputs(BASIC_FORM_VALUES);
    const parsed = parseScenarioJsonExport();

    expect(parsed.formValues).toEqual(BASIC_FORM_VALUES);
    expect(parsed.scenario).toEqual(scenario);
    expect(parsed.withdrawalPlan).toEqual(plan);
    expect(parsed.projectionInputs).toEqual({
      scenario,
      plan,
      customLawActive: false,
    });
  });

  it('keeps the canonical payload URL-hash round-trip compatible', () => {
    const parsed = parseScenarioJsonExport();

    expect(parsed.payload).toEqual(decodeScenario(parsed.canonicalScenarioHash));
    expect(decodeScenario(encodeScenario(parsed.payload))).toEqual(parsed.payload);
  });

  it('includes sparse custom law data when present', () => {
    const customLaw = {
      niit: {
        rate: 0.05,
      },
    } satisfies CustomLaw;
    const parsed = parseScenarioJsonExport(customLaw);

    expect(parsed.customLaw).toEqual(customLaw);
    expect(parsed.projectionInputs.customLaw).toEqual(customLaw);
    expect(parsed.payload.customLaw).toEqual(customLaw);
    expect(parsed.payload.customLawActive).toBe(true);
    expect(parsed.payload).toEqual(decodeScenario(parsed.canonicalScenarioHash));
  });
});
