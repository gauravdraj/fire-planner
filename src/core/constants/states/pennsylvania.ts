import type { FlatStateTaxLaw } from '../../tax/state';

const RETRIEVED_AT = '2026-04-26';
const PA_DOR_PERSONAL_INCOME_TAX =
  'Pennsylvania Department of Revenue, Personal Income Tax overview, 3.07 percent rate, https://www.revenue.pa.gov/TaxTypes/PIT/Pages/default.aspx';

export const PENNSYLVANIA_STATE_TAX = Object.freeze({
  stateCode: 'PA',
  stateName: 'Pennsylvania',
  taxYear: 2026,
  source: PA_DOR_PERSONAL_INCOME_TAX,
  retrievedAt: RETRIEVED_AT,
  kind: 'flat',
  rate: 0.0307,
} satisfies FlatStateTaxLaw);
