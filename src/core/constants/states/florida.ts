import type { NoIncomeTaxStateLaw } from '../../tax/state';

const RETRIEVED_AT = '2026-04-26';
const FLORIDA_DOR_INDIVIDUAL_INCOME_TAX =
  'Florida Department of Revenue FAQ, State of Florida does not have an income tax for individuals, https://floridarevenue.com/faq/Pages/FAQDetails.aspx?FAQID=1307&IsDlg=1';

export const FLORIDA_STATE_TAX = Object.freeze({
  stateCode: 'FL',
  stateName: 'Florida',
  taxYear: 2026,
  source: FLORIDA_DOR_INDIVIDUAL_INCOME_TAX,
  retrievedAt: RETRIEVED_AT,
  kind: 'none',
} satisfies NoIncomeTaxStateLaw);
