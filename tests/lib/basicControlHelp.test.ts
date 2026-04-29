import { describe, expect, it } from 'vitest';

import { basicControlHelp, basicControlIds } from '@/lib/basicControlHelp';

const EXPECTED_BASIC_CONTROL_IDS = [
  'filingStatus',
  'stateCode',
  'primaryAge',
  'partnerAge',
  'currentYear',
  'retirementYear',
  'planEndAge',
  'socialSecurityClaimAge',
  'annualSpendingToday',
  'inflationRate',
  'annualMortgagePAndI',
  'mortgagePayoffYear',
  'traditionalBalance',
  'rothBalance',
  'brokerageAndCashBalance',
  'taxableBrokerageBasis',
  'hsaBalance',
  'annualContributionTraditional',
  'annualContributionRoth',
  'annualContributionHsa',
  'annualContributionBrokerage',
  'expectedReturnTraditional',
  'expectedReturnRoth',
  'expectedReturnBrokerage',
  'expectedReturnHsa',
  'brokerageDividendYield',
  'brokerageQdiPercentage',
  'autoDepleteBrokerageEnabled',
  'autoDepleteBrokerageYears',
  'autoDepleteBrokerageAnnualScaleUpFactor',
  'annualW2Income',
  'annualConsultingIncome',
  'annualRentalIncome',
  'annualSocialSecurityBenefit',
  'annualPensionOrAnnuityIncome',
  'healthcarePhase',
] as const;

describe('basicControlHelp', () => {
  it('keeps the stable basic-control id list explicit', () => {
    expect(basicControlIds).toEqual(EXPECTED_BASIC_CONTROL_IDS);
    expect(new Set(basicControlIds).size).toBe(basicControlIds.length);
  });

  it('has one help entry for every basic control id', () => {
    expect(Object.keys(basicControlHelp).sort()).toEqual([...basicControlIds].sort());
  });

  it('uses concise non-empty label and tooltip text for each control', () => {
    for (const controlId of basicControlIds) {
      const entry = basicControlHelp[controlId];

      expect(Object.keys(entry).sort()).toEqual(['description', 'label']);
      expect(entry.label.trim()).not.toBe('');
      expect(entry.description.trim()).not.toBe('');
      expect(entry.description.length).toBeLessThanOrEqual(150);
    }
  });

  it('covers select and checkbox controls as well as text inputs', () => {
    expect(basicControlHelp.filingStatus).toBeDefined();
    expect(basicControlHelp.stateCode).toBeDefined();
    expect(basicControlHelp.healthcarePhase).toBeDefined();
    expect(basicControlHelp.autoDepleteBrokerageEnabled).toBeDefined();
  });

  it('names the indexed assumptions controlled by the basic inflation rate', () => {
    expect(basicControlHelp.inflationRate.description).toContain('spending growth');
    expect(basicControlHelp.inflationRate.description).toContain('federal bracket indexing after 2026');
    expect(basicControlHelp.inflationRate.description).toContain('FPL indexing');
  });
});
