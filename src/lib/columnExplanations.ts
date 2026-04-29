export type ExplanationEntry = Readonly<{
  label: string;
  description: string;
}>;

export const tableColumnIds = [
  'year',
  'age',
  'phase',
  'openingBalance',
  'cashBalance',
  'taxableBrokerageBalance',
  'traditionalBalance',
  'rothBalance',
  'hsaBalance',
  'endingBalance',
  'brokerageBasisRemaining',
  'spending',
  'wages',
  'totalWithdrawals',
  'traditionalWithdrawals',
  'brokerageWithdrawals',
  'rothConversions',
  'ltcgHarvests',
  'realizedLtcg',
  'agi',
  'acaMagi',
  'irmaaMagi',
  'taxableSocialSecurity',
  'federalTax',
  'stateTax',
  'ltcgTax',
  'niit',
  'seTax',
  'acaPremiumCredit',
  'irmaaPremium',
  'totalTax',
  'afterTaxCashFlow',
  'fplPercentage',
  'withdrawalRate',
  'federalBracketProximity',
  'warnings',
] as const;

export type TableColumnId = (typeof tableColumnIds)[number];

export const liveStatMetricIds = [
  'net-worth-at-retirement',
  'plan-end-balance',
  'years-funded',
  'average-bridge-magi',
  'max-bridge-draw-percentage',
  'total-bridge-tax',
] as const;

export type LiveStatMetricId = (typeof liveStatMetricIds)[number];

export const basicFormSectionIds = [
  'household',
  'timeline',
  'spending',
  'balances',
  'growthDividends',
  'withdrawalStrategy',
  'income',
  'healthcare',
] as const;

export type BasicFormSectionId = (typeof basicFormSectionIds)[number];

export const columnExplanations = {
  year: {
    label: 'Year',
    description: 'Projection calendar year. All tax and balance values are shown for this annual row.',
  },
  age: {
    label: 'Age',
    description: 'Primary person age in the projection year, derived from the current age and calendar year.',
  },
  phase: {
    label: 'Phase',
    description: 'Plain-language year label such as pre-retirement, bridge, Medicare-eligible, or Social Security claimed.',
  },
  openingBalance: {
    label: 'Opening balance',
    description: 'Total supported account balance at the start of the year before withdrawals and market returns.',
  },
  cashBalance: {
    label: 'Cash',
    description: 'Cash bucket balance at year end after spending, withdrawals, and returns.',
  },
  taxableBrokerageBalance: {
    label: 'Taxable brokerage',
    description: 'Taxable brokerage balance at year end after sales, harvests, basis changes, and returns.',
  },
  traditionalBalance: {
    label: 'Traditional',
    description: 'Traditional pre-tax retirement account balance at year end after withdrawals, conversions, and returns.',
  },
  rothBalance: {
    label: 'Roth',
    description: 'Roth account balance at year end after conversions, withdrawals, and returns.',
  },
  hsaBalance: {
    label: 'HSA',
    description: 'HSA balance at year end after qualified medical withdrawals and returns.',
  },
  endingBalance: {
    label: 'Ending balance',
    description: 'Total supported account balance at year end across cash, HSA, taxable brokerage, traditional, and Roth buckets.',
  },
  brokerageBasisRemaining: {
    label: 'Brokerage basis remaining',
    description: 'Remaining taxable brokerage cost basis after modeled sales, harvests, and basis adjustments for the year.',
  },
  spending: {
    label: 'Spending',
    description: 'Nominal annual spending target for the projection year before tax effects.',
  },
  wages: {
    label: 'Wages',
    description: 'W-2 income scheduled for the projection year.',
  },
  totalWithdrawals: {
    label: 'Total withdrawals',
    description: 'Total cash drawn from supported account buckets to fund the year.',
  },
  traditionalWithdrawals: {
    label: 'IRA distributions',
    description: 'Traditional pre-tax retirement account distributions taken during the projection year.',
  },
  brokerageWithdrawals: {
    label: 'Brokerage withdrawals',
    description: 'Taxable brokerage dollars sold or withdrawn to fund the projection year.',
  },
  rothConversions: {
    label: 'Roth conversions',
    description: 'Traditional account dollars converted to Roth in the projection year.',
  },
  ltcgHarvests: {
    label: 'LTCG harvests',
    description: 'Planned taxable brokerage long-term capital gain harvest amount for the year.',
  },
  realizedLtcg: {
    label: 'Realized LTCG',
    description: 'Long-term capital gain realized from taxable brokerage sales and harvests during the year.',
  },
  agi: {
    label: 'AGI',
    description: 'Adjusted gross income before program-specific MAGI adjustments.',
  },
  acaMagi: {
    label: 'ACA MAGI',
    description: 'Modified adjusted gross income used for ACA premium tax credit eligibility and FPL percentage.',
  },
  irmaaMagi: {
    label: 'IRMAA MAGI',
    description: 'Modified adjusted gross income used for Medicare IRMAA surcharge lookback calculations.',
  },
  taxableSocialSecurity: {
    label: 'Taxable Social Security',
    description: 'The portion of Social Security benefits included in taxable income for the year.',
  },
  federalTax: {
    label: 'Federal tax',
    description: 'Regular federal ordinary income tax before separate capital gain, NIIT, self-employment, and state taxes.',
  },
  stateTax: {
    label: 'State tax',
    description: 'Estimated starter-state income tax for the selected state law model.',
  },
  ltcgTax: {
    label: 'LTCG tax',
    description: 'Federal long-term capital gains and qualified dividends tax from the capital gain stacking calculation.',
  },
  niit: {
    label: 'NIIT',
    description: 'Net investment income tax from taxable investment and eligible rental income over the NIIT threshold.',
  },
  seTax: {
    label: 'SE tax',
    description: 'Self-employment tax estimated from net consulting income.',
  },
  acaPremiumCredit: {
    label: 'ACA PTC',
    description: 'ACA premium tax credit for marketplace coverage, shown as a tax offset when eligible.',
  },
  irmaaPremium: {
    label: 'IRMAA premiums',
    description: 'Medicare IRMAA surcharge premiums assigned from the applicable MAGI lookback year.',
  },
  totalTax: {
    label: 'Total tax',
    description: 'Combined annual tax estimate after included federal, state, NIIT, SE tax, and ACA credit effects.',
  },
  afterTaxCashFlow: {
    label: 'After-tax cash flow',
    description: 'Cash available after modeled income, withdrawals, taxes, ACA credits, and IRMAA surcharges are applied.',
  },
  fplPercentage: {
    label: 'FPL %',
    description: 'ACA MAGI divided by the Federal Poverty Level for the coverage household and region.',
  },
  withdrawalRate: {
    label: 'Withdrawal rate',
    description: 'Total withdrawals divided by the prior year closing supported account balance.',
  },
  federalBracketProximity: {
    label: 'Federal bracket room',
    description: 'Distance from projected federal taxable income to the next ordinary income bracket edge.',
  },
  warnings: {
    label: 'Warnings',
    description: 'Projection warnings that highlight modeled threshold crossings or data limitations for the year.',
  },
} as const satisfies Record<TableColumnId, ExplanationEntry>;

export const liveStatExplanations = {
  'net-worth-at-retirement': {
    label: 'Net worth at retirement',
    description: 'Opening supported account balance in the selected retirement year.',
  },
  'plan-end-balance': {
    label: 'Plan-end balance',
    description: 'Closing supported account balance in the final projected year.',
  },
  'years-funded': {
    label: 'Years funded',
    description: 'Number of contiguous projected years funded from the retirement year before balances deplete.',
  },
  'average-bridge-magi': {
    label: 'Average MAGI',
    description: 'Average ACA MAGI across the bridge window from retirement until Medicare or Social Security changes the phase.',
  },
  'max-bridge-draw-percentage': {
    label: 'Max gross bucket draw',
    description: 'Largest annual withdrawal draw as a percentage of opening supported balances during the bridge window.',
  },
  'total-bridge-tax': {
    label: 'Total bridge tax',
    description: 'Total modeled tax across the bridge years, before Medicare or Social Security changes the planning phase.',
  },
} as const satisfies Record<LiveStatMetricId, ExplanationEntry>;

export const basicFormSectionExplanations = {
  household: {
    label: 'Household',
    description: 'Filing status, state, and household ages that drive tax brackets, state law, and age-based assumptions.',
  },
  timeline: {
    label: 'Timeline',
    description: 'Current year, retirement year, plan end, and claiming ages that set the projection window.',
  },
  spending: {
    label: 'Spending & debt',
    description:
      'Annual living-spending target, inflation assumption, and fixed mortgage principal and interest that the projection tries to fund.',
  },
  balances: {
    label: 'Accounts',
    description: 'Starting supported account balances, including HSA, and taxable basis used by the withdrawal display layer.',
  },
  growthDividends: {
    label: 'Growth & dividends',
    description:
      'Expected account returns plus taxable brokerage dividend yield and qualified-dividend share assumptions.',
  },
  withdrawalStrategy: {
    label: 'Withdrawal strategy',
    description: 'Controls for optional automatic taxable brokerage draw scheduling before default account allocation.',
  },
  income: {
    label: 'Income',
    description: 'Recurring work, rental, Social Security, pension, and annuity income assumptions.',
  },
  healthcare: {
    label: 'Healthcare',
    description: 'Healthcare phase used to surface ACA premium tax credit and Medicare IRMAA implications.',
  },
} as const satisfies Record<BasicFormSectionId, ExplanationEntry>;
