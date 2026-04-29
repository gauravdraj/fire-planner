import type { BasicFormValues } from './basicFormMapping';

export type BasicControlHelpEntry = Readonly<{
  label: string;
  description: string;
}>;

export const basicControlIds = [
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
  'startingRothContributionBasis',
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
] as const satisfies ReadonlyArray<keyof BasicFormValues>;

export type BasicControlId = (typeof basicControlIds)[number];

type AssertNever<T extends never> = T;
type _BasicControlIdsCoverFormValues = AssertNever<Exclude<keyof BasicFormValues, BasicControlId>>;
type _BasicControlIdsAreFormValues = AssertNever<Exclude<BasicControlId, keyof BasicFormValues>>;

export const basicControlHelp = {
  filingStatus: {
    label: 'Filing status',
    description: 'Sets federal brackets, deductions, Social Security taxation, and Medicare IRMAA thresholds.',
  },
  stateCode: {
    label: 'State',
    description: 'Chooses the starter state tax model; this is not full residency or multi-state allocation.',
  },
  primaryAge: {
    label: 'Primary age',
    description: 'Anchors the age timeline and plan-end year calculation.',
  },
  partnerAge: {
    label: 'Partner age',
    description: 'Used for married-filing-jointly age flags such as senior tax treatment.',
  },
  currentYear: {
    label: 'Current year',
    description: 'Starts the projection window and pre-retirement income schedule.',
  },
  retirementYear: {
    label: 'Retirement target year',
    description: 'Marks when work income stops and retirement withdrawals can begin.',
  },
  planEndAge: {
    label: 'Plan-end age',
    description: 'Sets the final projection year from the primary person age.',
  },
  socialSecurityClaimAge: {
    label: 'Social Security claim age',
    description: 'Sets the first benefit year from the primary person age.',
  },
  annualSpendingToday: {
    label: 'Annual spending',
    description: 'Entered in today\'s dollars and inflated each projection year before taxes and withdrawals.',
  },
  inflationRate: {
    label: 'Inflation rate',
    description: 'Single annual rate used for spending growth, federal bracket indexing after 2026, and FPL indexing.',
  },
  annualMortgagePAndI: {
    label: 'Annual mortgage P&I',
    description: 'Fixed nominal principal and interest through payoff year, separate from living spending.',
  },
  mortgagePayoffYear: {
    label: 'Mortgage payoff year',
    description: 'Stops mortgage P&I after this year; enter 0 when no mortgage applies.',
  },
  traditionalBalance: {
    label: 'Traditional balance',
    description: 'Starting pre-tax balance for default withdrawals, Roth conversions, taxes, and returns.',
  },
  rothBalance: {
    label: 'Roth balance',
    description: 'Starting Roth balance. Tax-free withdrawal treatment now depends on the Roth basis fields below.',
  },
  startingRothContributionBasis: {
    label: 'Starting Roth contribution basis',
    description: 'Estimated Roth contribution basis available before conversion layers; verify against records or Form 8606.',
  },
  brokerageAndCashBalance: {
    label: 'Brokerage plus cash balance',
    description: 'Starting taxable brokerage value in basic mode; cash remains at the internal default.',
  },
  taxableBrokerageBasis: {
    label: 'Weighted-average taxable basis',
    description: 'Cost basis for estimating taxable gains from brokerage sales and reinvested dividends.',
  },
  hsaBalance: {
    label: 'HSA balance',
    description: 'Starting HSA balance available for qualified medical withdrawals before taxable account draws.',
  },
  annualContributionTraditional: {
    label: 'Traditional annual contribution',
    description: 'Pre-tax annual contribution before retirement; reduces W-2 AGI in the simplified model.',
  },
  annualContributionRoth: {
    label: 'Roth annual contribution',
    description: 'Post-tax annual contribution before retirement; does not reduce AGI or taxes.',
  },
  annualContributionHsa: {
    label: 'HSA annual contribution',
    description: 'Pre-tax annual HSA contribution before retirement; reduces W-2 AGI in the simplified model.',
  },
  annualContributionBrokerage: {
    label: 'Brokerage annual contribution',
    description: 'Post-tax annual contribution to taxable brokerage before retirement; does not reduce AGI or taxes.',
  },
  expectedReturnTraditional: {
    label: 'Traditional expected return',
    description: 'Annual nominal return applied to the traditional bucket each projected year.',
  },
  expectedReturnRoth: {
    label: 'Roth expected return',
    description: 'Annual nominal return applied to the Roth bucket each projected year.',
  },
  expectedReturnBrokerage: {
    label: 'Brokerage expected return',
    description: 'Annual nominal price return; dividends, when modeled, are taxed and reinvested separately.',
  },
  expectedReturnHsa: {
    label: 'HSA expected return',
    description: 'Annual nominal return applied to the HSA bucket each projected year.',
  },
  brokerageDividendYield: {
    label: 'Brokerage dividend yield',
    description: 'Annual dividends generated from the opening taxable brokerage balance.',
  },
  brokerageQdiPercentage: {
    label: 'Qualified dividend percentage',
    description: 'Share of generated dividends treated as qualified for capital gains tax.',
  },
  autoDepleteBrokerageEnabled: {
    label: 'Auto-deplete brokerage',
    description: 'Adds a taxable brokerage draw schedule before the default account order, no earlier than retirement.',
  },
  autoDepleteBrokerageYears: {
    label: 'Brokerage depletion years',
    description: 'Years over which the optional schedule tries to deplete taxable brokerage.',
  },
  autoDepleteBrokerageAnnualScaleUpFactor: {
    label: 'Brokerage annual scale-up factor',
    description: 'Annual growth rate for the optional draw schedule, e.g. 0.02 for 2%.',
  },
  annualW2Income: {
    label: 'W-2 income',
    description: 'Recurring wages through the year before retirement.',
  },
  annualConsultingIncome: {
    label: 'Net consulting income',
    description: 'Net self-employment income before retirement, included in tax and MAGI estimates.',
  },
  annualRentalIncome: {
    label: 'Net rental income',
    description: 'Net rental income included in AGI and MAGI under the simplified model.',
  },
  annualSocialSecurityBenefit: {
    label: 'Social Security annual benefit',
    description: 'Annual benefit from claim year onward, run through taxable Social Security rules.',
  },
  annualPensionOrAnnuityIncome: {
    label: 'Pension/annuity annual amount',
    description: 'Recurring pension or annuity income from the retirement year onward.',
  },
  healthcarePhase: {
    label: 'Healthcare phase',
    description: 'Chooses whether ACA PTC or Medicare IRMAA effects appear in the projection.',
  },
} as const satisfies Record<BasicControlId, BasicControlHelpEntry>;
