import { describe, expect, it } from 'vitest';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

import type { CustomLaw } from '@/core/constants/customLaw';
import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import { decodeScenario, encodeScenario } from '@/lib/urlHash';

const BASIC_FORM_VALUES: BasicFormValues = {
  currentYear: 2026,
  filingStatus: 'mfj',
  stateCode: 'FL',
  primaryAge: 62,
  partnerAge: 66,
  retirementYear: 2028,
  planEndAge: 90,
  annualSpendingToday: 120_000,
  inflationRate: 0.025,
  annualMortgagePAndI: 0,
  mortgagePayoffYear: 0,
  annualW2Income: 220_000,
  annualConsultingIncome: 25_000,
  annualRentalIncome: 18_000,
  annualSocialSecurityBenefit: 52_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 15_000,
  brokerageAndCashBalance: 900_000,
  taxableBrokerageBasis: 620_000,
  hsaBalance: 35_000,
  traditionalBalance: 1_100_000,
  rothBalance: 260_000,
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

const CUSTOM_LAW = {
  federal: {
    standardDeduction: {
      single: 20_000,
      mfj: 40_000,
      hoh: 30_000,
      mfs: 20_000,
    },
  },
} satisfies CustomLaw;

function buildProjectionInputs() {
  return mapBasicFormToProjectionInputs(BASIC_FORM_VALUES);
}

function decodeRawPayload(hash: string): unknown {
  const compressedPayload = hash.slice('v1:'.length);
  const json = decompressFromEncodedURIComponent(compressedPayload);

  return JSON.parse(json);
}

describe('URL hash scenario codec', () => {
  it('round-trips a populated scenario payload and keeps only shareable active state', () => {
    const { scenario, plan } = buildProjectionInputs();
    const advancedPlan = {
      ...plan,
      rothConversions: [{ year: scenario.startYear + 1, amount: 25_000 }],
      brokerageHarvests: [{ year: scenario.startYear + 2, amount: 12_500 }],
    };
    const payloadWithUiState = {
      scenario,
      plan: advancedPlan,
      mode: 'advanced',
      displayUnit: 'real',
    };

    const encoded = encodeScenario(payloadWithUiState);

    expect(encoded.startsWith('v1:')).toBe(true);
    expect(decodeScenario(encoded)).toEqual({ scenario, plan: advancedPlan, customLawActive: false });
    expect(decodeScenario(`#${encoded}`)).toEqual({ scenario, plan: advancedPlan, customLawActive: false });
    expect(Object.keys(decodeRawPayload(encoded) as Record<string, unknown>).sort()).toEqual([
      'customLawActive',
      'plan',
      'scenario',
    ]);
  });

  it('encodes custom-law overrides and excludes named-scenario local identifiers', () => {
    const { scenario, plan } = buildProjectionInputs();
    const payloadWithLocalState = {
      scenario,
      plan,
      customLaw: CUSTOM_LAW,
      customLawActive: true,
      namedScenarioId: 'local-only-id',
      activeScenarioIndex: 2,
    };

    const encoded = encodeScenario(payloadWithLocalState);
    const decoded = decodeScenario(encoded);
    const rawPayload = decodeRawPayload(encoded) as Record<string, unknown>;

    expect(decoded).toEqual({
      scenario: { ...scenario, customLaw: CUSTOM_LAW },
      plan,
      customLaw: CUSTOM_LAW,
      customLawActive: true,
    });
    expect(Object.keys(rawPayload).sort()).toEqual(['customLaw', 'customLawActive', 'plan', 'scenario']);
    expect(rawPayload).not.toHaveProperty('namedScenarioId');
    expect(rawPayload).not.toHaveProperty('activeScenarioIndex');
  });

  it('hydrates legacy Gate 3 hashes that only contain scenario plus plan', () => {
    const { scenario, plan } = buildProjectionInputs();
    const legacyHash = `v1:${compressToEncodedURIComponent(JSON.stringify({ scenario, plan }))}`;

    expect(decodeScenario(legacyHash)).toEqual({ scenario, plan, customLawActive: false });
  });

  it('requires both a true flag and non-empty overrides before marking custom law active', () => {
    const { scenario, plan } = buildProjectionInputs();
    const emptyOverrideHash = `v1:${compressToEncodedURIComponent(
      JSON.stringify({ scenario, plan, customLaw: {}, customLawActive: true }),
    )}`;
    const inactiveOverrideHash = encodeScenario({ scenario, plan, customLaw: CUSTOM_LAW, customLawActive: false });

    expect(decodeScenario(emptyOverrideHash)).toEqual({
      scenario,
      plan,
      customLaw: {},
      customLawActive: false,
    });
    expect(decodeScenario(inactiveOverrideHash)).toEqual({
      scenario,
      plan,
      customLaw: CUSTOM_LAW,
      customLawActive: false,
    });
  });

  it.each(['', '#', 'not-a-share-hash', 'v1:', '#v1:', 'v1:not-valid-compressed-data'])(
    'returns null for malformed hash input %s',
    (hash) => {
      expect(decodeScenario(hash)).toBeNull();
    },
  );

  it('returns null for unsupported version tags', () => {
    const { scenario, plan } = buildProjectionInputs();
    const encoded = encodeScenario({ scenario, plan });

    expect(decodeScenario(encoded.replace(/^v1:/, 'v2:'))).toBeNull();
  });

  it('returns null for parse failures and missing required plan data', () => {
    const invalidJsonHash = `v1:${compressToEncodedURIComponent('{not-json')}`;
    const missingPlanHash = `v1:${compressToEncodedURIComponent(JSON.stringify({ scenario: {} }))}`;

    expect(decodeScenario(invalidJsonHash)).toBeNull();
    expect(decodeScenario(missingPlanHash)).toBeNull();
  });

  it('keeps a realistic share payload under 4096 bytes', () => {
    const { scenario, plan } = buildProjectionInputs();
    const encoded = encodeScenario({ scenario, plan });

    expect(encoded.length).toBeLessThan(4096);
  });
});
