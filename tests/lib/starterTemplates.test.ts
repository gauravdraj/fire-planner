import { describe, expect, it } from 'vitest';

import { runProjection, type AccountBalances } from '@/core/projection';
import { mapBasicFormToProjectionInputs } from '@/lib/basicFormMapping';
import starterTemplatesSource from '@/lib/starterTemplates?raw';
import { STARTER_TEMPLATES } from '@/lib/starterTemplates';
import { DEFAULT_BASIC_FORM_VALUES } from '@/store/scenarioStore';

function totalBalance(balances: AccountBalances): number {
  return balances.cash + balances.hsa + balances.taxableBrokerage + balances.traditional + balances.roth;
}

function templateById(id: (typeof STARTER_TEMPLATES)[number]['id']) {
  const template = STARTER_TEMPLATES.find((candidate) => candidate.id === id);

  if (template === undefined) {
    throw new Error(`Missing starter template ${id}`);
  }

  return template;
}

describe('starter templates', () => {
  it('exports exactly the five Phase 2 starter scenarios in order', () => {
    expect(STARTER_TEMPLATES.map((template) => template.id)).toEqual([
      'brokerage-bridge-72t',
      'roth-ladder',
      'ltcg-harvest',
      'aca-optimized',
      'conservative-no-customlaw',
    ]);
  });

  it('keeps required descriptions honest and stable against tax-output drift', () => {
    const brokerageBridge = STARTER_TEMPLATES[0];
    const ltcgHarvest = templateById('ltcg-harvest');
    const acaOptimized = templateById('aca-optimized');
    const conservative = templateById('conservative-no-customlaw');

    expect(brokerageBridge?.longDescription).toMatch(/10-year auto-deplete taxable brokerage bridge/i);
    expect(brokerageBridge?.longDescription).toMatch(/does not introduce a separate 72\(t\) SEPP withdrawal stream/i);
    expect(ltcgHarvest.longDescription).toMatch(/Large unrealized gains in brokerage/i);
    expect(ltcgHarvest.longDescription).toMatch(/stay inside the 0% LTCG bracket/i);
    expect(acaOptimized.longDescription).toMatch(/Trad-heavy with limited brokerage runway/i);
    expect(acaOptimized.longDescription).toMatch(/200-400% FPL band/i);
    expect(conservative.longDescription).toMatch(/Single filer near Medicare-eligibility/i);
    expect(conservative.longDescription).toMatch(/no auto-deplete/i);

    for (const template of STARTER_TEMPLATES) {
      expect(template.longDescription).not.toMatch(/\$\d/);
    }
  });

  it('encodes the three Phase 2 starter template assumptions as basic form data', () => {
    expect(templateById('ltcg-harvest').formValues).toMatchObject({
      currentYear: 2026,
      filingStatus: 'mfj',
      primaryAge: 50,
      partnerAge: 50,
      retirementYear: 2026,
      planEndAge: 95,
      annualSpendingToday: 80_000,
      annualMortgagePAndI: 0,
      mortgagePayoffYear: 0,
      annualSocialSecurityBenefit: 25_000,
      socialSecurityClaimAge: 67,
      brokerageAndCashBalance: 1_200_000,
      taxableBrokerageBasis: 400_000,
      hsaBalance: 30_000,
      traditionalBalance: 400_000,
      rothBalance: 50_000,
      autoDepleteBrokerageEnabled: true,
      autoDepleteBrokerageYears: 15,
      autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
      expectedReturnTraditional: 0.05,
      expectedReturnRoth: 0.05,
      expectedReturnBrokerage: 0.05,
      expectedReturnHsa: 0.05,
      brokerageDividendYield: 0.014,
      brokerageQdiPercentage: 0.95,
      healthcarePhase: 'aca',
    });

    expect(templateById('aca-optimized').formValues).toMatchObject({
      currentYear: 2026,
      filingStatus: 'mfj',
      primaryAge: 55,
      partnerAge: 55,
      retirementYear: 2027,
      planEndAge: 90,
      annualSpendingToday: 60_000,
      annualMortgagePAndI: 0,
      mortgagePayoffYear: 0,
      annualSocialSecurityBenefit: 35_000,
      socialSecurityClaimAge: 70,
      brokerageAndCashBalance: 200_000,
      taxableBrokerageBasis: 150_000,
      hsaBalance: 40_000,
      traditionalBalance: 1_500_000,
      rothBalance: 300_000,
      autoDepleteBrokerageEnabled: true,
      autoDepleteBrokerageYears: 8,
      autoDepleteBrokerageAnnualScaleUpFactor: 0.015,
      expectedReturnTraditional: 0.04,
      expectedReturnRoth: 0.04,
      expectedReturnBrokerage: 0.04,
      expectedReturnHsa: 0.04,
      brokerageDividendYield: 0.015,
      brokerageQdiPercentage: 0.9,
      healthcarePhase: 'aca',
    });

    expect(templateById('conservative-no-customlaw').formValues).toMatchObject({
      currentYear: 2026,
      filingStatus: 'single',
      primaryAge: 60,
      partnerAge: 60,
      retirementYear: 2026,
      planEndAge: 95,
      annualSpendingToday: 55_000,
      annualMortgagePAndI: 12_000,
      mortgagePayoffYear: 2028,
      annualSocialSecurityBenefit: 40_000,
      socialSecurityClaimAge: 67,
      brokerageAndCashBalance: 500_000,
      taxableBrokerageBasis: 350_000,
      hsaBalance: 25_000,
      traditionalBalance: 700_000,
      rothBalance: 200_000,
      autoDepleteBrokerageEnabled: false,
      expectedReturnTraditional: 0.04,
      expectedReturnRoth: 0.04,
      expectedReturnBrokerage: 0.04,
      expectedReturnHsa: 0.04,
      brokerageDividendYield: 0.014,
      brokerageQdiPercentage: 0.95,
      healthcarePhase: 'aca',
    });
  });

  it('provides complete basic form values and user-facing copy for each template', () => {
    const defaultKeys = Object.keys(DEFAULT_BASIC_FORM_VALUES).sort();

    for (const template of STARTER_TEMPLATES) {
      expect(template.label.trim(), template.id).not.toBe('');
      expect(template.shortDescription.trim(), template.id).not.toBe('');
      expect(template.longDescription.trim(), template.id).not.toBe('');
      expect(Object.keys(template.formValues).sort(), template.id).toEqual(defaultKeys);
    }
  });

  it('maps every starter scenario through basic form projection', () => {
    for (const template of STARTER_TEMPLATES) {
      const values = { ...DEFAULT_BASIC_FORM_VALUES, ...template.formValues };
      const { scenario, plan } = mapBasicFormToProjectionInputs(values);
      const projection = runProjection(scenario, plan);
      const finalYear = projection.at(-1);
      const endingBalance = totalBalance(
        finalYear?.closingBalances ?? { cash: 0, hsa: 0, taxableBrokerage: 0, traditional: 0, roth: 0 },
      );

      expect(projection.length, template.id).toBeGreaterThan(0);
      expect(finalYear, template.id).toBeDefined();
      expect(Number.isFinite(endingBalance), template.id).toBe(true);

      if (template.formValues.autoDepleteBrokerageEnabled) {
        expect(endingBalance, template.id).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('uses the current basic form auto-deplete field names', () => {
    expect(STARTER_TEMPLATES[0]?.formValues).toMatchObject({
      autoDepleteBrokerageEnabled: true,
      autoDepleteBrokerageYears: 10,
      autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
    });
    expect(STARTER_TEMPLATES[1]?.formValues).toMatchObject({
      autoDepleteBrokerageEnabled: true,
      autoDepleteBrokerageYears: 5,
      autoDepleteBrokerageAnnualScaleUpFactor: 0.03,
    });
    expect(templateById('ltcg-harvest').formValues).toMatchObject({
      autoDepleteBrokerageEnabled: true,
      autoDepleteBrokerageYears: 15,
      autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
    });
    expect(templateById('aca-optimized').formValues).toMatchObject({
      autoDepleteBrokerageEnabled: true,
      autoDepleteBrokerageYears: 8,
      autoDepleteBrokerageAnnualScaleUpFactor: 0.015,
    });
    expect(templateById('conservative-no-customlaw').formValues).toMatchObject({
      autoDepleteBrokerageEnabled: false,
    });
  });

  it('keeps the starter template module free of UI, store, browser, and projection imports', () => {
    expect(starterTemplatesSource).not.toMatch(/from ['"]react(?:\/|['"])/);
    expect(starterTemplatesSource).not.toMatch(/from ['"]zustand(?:\/|['"])/);
    expect(starterTemplatesSource).not.toMatch(/from ['"]@\/store\//);
    expect(starterTemplatesSource).not.toMatch(/from ['"]@\/core\/projection['"]/);
    expect(starterTemplatesSource).not.toMatch(/\b(?:window|document|localStorage|sessionStorage)\./);
  });
});
