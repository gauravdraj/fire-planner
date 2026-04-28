import { describe, expect, it } from 'vitest';

import { CONSTANTS_2026 } from '@/core/constants/2026';
import { mapBasicFormToProjectionInputs, type BasicFormValues } from '@/lib/basicFormMapping';
import {
  APP_VERSION,
  balanceSweepContract,
  buildExportMetadata,
  buildScenarioJsonExportEnvelope,
  methodologySourceContract,
  withdrawalPlanManualFields,
} from '@/lib/exportContracts';
import { decodeScenario } from '@/lib/urlHash';

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

describe('Phase 2 export contracts', () => {
  it('uses concrete metadata sources without adding runtime dependencies', () => {
    expect(APP_VERSION).toBe(packageJson.version);
    expect(buildExportMetadata('2026-04-27T17:39:00.000Z')).toEqual({
      appVersion: packageJson.version,
      constantsRetrievedAt: CONSTANTS_2026.retrievedAt,
      generatedAt: '2026-04-27T17:39:00.000Z',
      canonicalScenarioFormat: 'urlHash:v1',
    });
  });

  it('documents that methodology source URLs stay UI-adjacent instead of mutating core constants', () => {
    expect(methodologySourceContract).toEqual({
      constantsRetrievedAt: CONSTANTS_2026.retrievedAt,
      hasPerConstantSourceUrls: false,
      sourceUrlLocation: 'methodology-content',
    });
  });

  it('wraps the canonical URL hash payload for JSON exports', () => {
    const { scenario, plan } = mapBasicFormToProjectionInputs(BASIC_FORM_VALUES);
    const envelope = buildScenarioJsonExportEnvelope({ scenario, plan }, '2026-04-27T17:39:00.000Z');

    expect(envelope.metadata.canonicalScenarioFormat).toBe('urlHash:v1');
    expect(envelope.canonicalScenarioHash).toMatch(/^v1:/);
    expect(envelope.payload).toEqual(decodeScenario(envelope.canonicalScenarioHash));
    expect(envelope.payload).toEqual({ scenario, plan, customLawActive: false });
  });

  it('defers balance sweep because current WithdrawalPlan fields cannot store manual brokerage withdrawals', () => {
    expect(withdrawalPlanManualFields).toEqual(['annualSpending', 'rothConversions', 'brokerageHarvests']);
    expect(balanceSweepContract.supported).toBe(false);
    expect(balanceSweepContract.reason).toContain('no field for manual brokerage-withdrawal targets');
    expect(balanceSweepContract.reason).toContain('annualSpending is a spending override');
  });
});
