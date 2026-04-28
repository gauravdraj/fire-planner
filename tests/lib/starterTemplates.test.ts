import { describe, expect, it } from 'vitest';

import { runProjection, type AccountBalances } from '@/core/projection';
import { mapBasicFormToProjectionInputs } from '@/lib/basicFormMapping';
import starterTemplatesSource from '@/lib/starterTemplates?raw';
import { STARTER_TEMPLATES } from '@/lib/starterTemplates';
import { DEFAULT_BASIC_FORM_VALUES } from '@/store/scenarioStore';

function totalBalance(balances: AccountBalances): number {
  return balances.cash + balances.hsa + balances.taxableBrokerage + balances.traditional + balances.roth;
}

describe('starter templates', () => {
  it('exports exactly the two Phase 1B starter scenarios in order', () => {
    expect(STARTER_TEMPLATES.map((template) => template.id)).toEqual(['brokerage-bridge-72t', 'roth-ladder']);
  });

  it('keeps required descriptions honest and stable against tax-output drift', () => {
    const brokerageBridge = STARTER_TEMPLATES[0];

    expect(brokerageBridge?.longDescription).toMatch(/10-year auto-deplete taxable brokerage bridge/i);
    expect(brokerageBridge?.longDescription).toMatch(/does not introduce a separate 72\(t\) SEPP withdrawal stream/i);

    for (const template of STARTER_TEMPLATES) {
      expect(template.longDescription).not.toMatch(/\$\d/);
    }
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

  it('maps every starter scenario through basic form projection with positive plan-end balances', () => {
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
      expect(endingBalance, template.id).toBeGreaterThan(0);
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
  });

  it('keeps the starter template module free of UI, store, browser, and projection imports', () => {
    expect(starterTemplatesSource).not.toMatch(/from ['"]react(?:\/|['"])/);
    expect(starterTemplatesSource).not.toMatch(/from ['"]zustand(?:\/|['"])/);
    expect(starterTemplatesSource).not.toMatch(/from ['"]@\/store\//);
    expect(starterTemplatesSource).not.toMatch(/from ['"]@\/core\/projection['"]/);
    expect(starterTemplatesSource).not.toMatch(/\b(?:window|document|localStorage|sessionStorage)\./);
  });
});
