import { describe, expect, it } from 'vitest';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

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
  annualW2Income: 220_000,
  annualConsultingIncome: 25_000,
  annualRentalIncome: 18_000,
  annualSocialSecurityBenefit: 52_000,
  socialSecurityClaimAge: 67,
  annualPensionOrAnnuityIncome: 15_000,
  brokerageAndCashBalance: 900_000,
  taxableBrokerageBasis: 620_000,
  traditionalBalance: 1_100_000,
  rothBalance: 260_000,
  healthcarePhase: 'aca',
};

function buildProjectionInputs() {
  return mapBasicFormToProjectionInputs(BASIC_FORM_VALUES);
}

function decodeRawPayload(hash: string): unknown {
  const compressedPayload = hash.slice('v1:'.length);
  const json = decompressFromEncodedURIComponent(compressedPayload);

  return JSON.parse(json);
}

describe('URL hash scenario codec', () => {
  it('round-trips a populated scenario payload and keeps only scenario plus plan', () => {
    const { scenario, plan } = buildProjectionInputs();
    const payloadWithUiState = {
      scenario,
      plan,
      mode: 'advanced',
      displayUnit: 'real',
    };

    const encoded = encodeScenario(payloadWithUiState);

    expect(encoded.startsWith('v1:')).toBe(true);
    expect(decodeScenario(encoded)).toEqual({ scenario, plan });
    expect(decodeScenario(`#${encoded}`)).toEqual({ scenario, plan });
    expect(Object.keys(decodeRawPayload(encoded) as Record<string, unknown>).sort()).toEqual(['plan', 'scenario']);
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
