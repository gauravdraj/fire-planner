import { CONSTANTS_2026 } from '@/core/constants/2026';

import {
  columnExplanations,
  liveStatExplanations,
  type ExplanationEntry,
  type LiveStatMetricId,
  type TableColumnId,
} from './columnExplanations';

const URL_PATTERN = /https?:\/\/[^\s;,]+/;

function formatDollars(value: number): string {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function sourceUrlFrom(source: string, fallbackUrl: string): string {
  return source.match(URL_PATTERN)?.[0] ?? fallbackUrl;
}

const CURATED_SOURCE_URLS = {
  irsRevProc2025_32: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
  irsNiit: 'https://www.irs.gov/individuals/net-investment-income-tax',
  irsObbbaSenior:
    'https://www.irs.gov/newsroom/one-big-beautiful-bill-act-tax-deductions-for-working-americans-and-seniors',
  irsScheduleSe2025: 'https://www.irs.gov/pub/irs-pdf/f1040sse.pdf',
  irc199a: 'https://uscode.house.gov/view.xhtml?req=(title:26%20section:199A%20edition:prelim)',
  hhsFpl2026: 'https://www.govinfo.gov/content/pkg/FR-2026-01-15/html/2026-00755.htm',
  hhsFpl2025:
    'https://www.federalregister.gov/documents/2025/01/17/2025-01377/annual-update-of-the-hhs-poverty-guidelines',
  irsRevProc2025_25: 'https://www.irs.gov/pub/irs-drop/rp-25-25.pdf',
  cmsIrmaa2026: 'https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles',
  ssaIrmaaLookback: 'https://secure.ssa.gov/poms.nsf/lnx/0601101020',
} as const;

export const methodologySectionIds = [
  'overview',
  'glossary',
  'modeled',
  'not-modeled',
  'constants-source',
  'two-year-lag',
  'metrics',
  'caveats',
  'source-references',
] as const;

export type MethodologySectionId = (typeof methodologySectionIds)[number];

export type MethodologyListItem = Readonly<{
  id: string;
  label: string;
  description: string;
}>;

export type NotModeledItem = Readonly<{
  id: string;
  label: string;
  designText: string;
  note: string;
}>;

export type ConstantSourceRow = Readonly<{
  id: string;
  name: string;
  value: string;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
}>;

export type MethodologyMetricEntry = Readonly<
  | {
      id: string;
      kind: 'table-column';
      sourceId: TableColumnId;
      explanation: ExplanationEntry;
    }
  | {
      id: string;
      kind: 'live-stat';
      sourceId: LiveStatMetricId;
      explanation: ExplanationEntry;
    }
>;

export type SourceReference = Readonly<{
  id: string;
  label: string;
  source: string;
  sourceUrl: string;
  retrievedAt?: string;
}>;

export type MethodologySection = Readonly<{
  id: MethodologySectionId;
  title: string;
  summary: string;
  paragraphs?: readonly string[];
  items?: readonly MethodologyListItem[];
  notModeledItems?: readonly NotModeledItem[];
  constantRows?: readonly ConstantSourceRow[];
  metricEntries?: readonly MethodologyMetricEntry[];
  sourceReferences?: readonly SourceReference[];
}>;

export const overviewParagraphs = [
  'Fire Planner is a free, open-source, client-only, fixture-validated, transparent retirement withdrawal planner.',
  'It estimates whether supported account buckets can fund a plan and highlights tax, healthcare, MAGI, ACA, IRMAA, and withdrawal-strategy tradeoffs.',
  'It is an educational estimator. It makes assumptions visible and testable, but it does not replace official worksheets, professional advice, or tax filing software.',
  'All inputs and projections stay in the browser. There is no backend account, cloud sync, analytics, or server persistence in the current architecture.',
] as const;

export const glossaryItems = [
  {
    id: 'magi',
    label: 'MAGI',
    description:
      'Modified adjusted gross income: AGI with program-specific addbacks. The app tracks ACA MAGI and IRMAA MAGI separately where rules differ.',
  },
  {
    id: 'irmaa',
    label: 'IRMAA',
    description:
      'Income-Related Monthly Adjustment Amount: a Medicare premium surcharge based on prior-year or prior-prior-year MAGI.',
  },
  {
    id: 'aca-ptc-fpl',
    label: 'ACA/PTC/FPL%',
    description:
      'ACA marketplace premium tax credits compare household MAGI to the Federal Poverty Level, expressed as an FPL percentage.',
  },
  {
    id: 'ltcg',
    label: 'LTCG',
    description:
      'Long-term capital gains: gains on assets held more than one year, stacked with qualified dividends into separate federal tax brackets.',
  },
  {
    id: 'qbi-sstb',
    label: 'QBI/SSTB',
    description:
      'Qualified business income deduction rules, including phaseouts that can limit specified service trade or business income.',
  },
  {
    id: 'niit',
    label: 'NIIT',
    description:
      'Net Investment Income Tax: a 3.8% federal tax on certain investment income when MAGI exceeds statutory thresholds.',
  },
  {
    id: 'sepp-72t',
    label: 'SEPP/72(t)',
    description:
      'Substantially Equal Periodic Payments under Internal Revenue Code section 72(t), used to avoid early-distribution penalties.',
  },
  {
    id: 'roth-conversion-ladder',
    label: 'Roth conversion ladder',
    description:
      'A sequence of traditional-to-Roth conversions that can create later Roth principal access while managing tax brackets.',
  },
  {
    id: 'custom-law-scenario',
    label: 'customLaw scenario',
    description:
      'A scenario-specific set of sparse law overrides layered over sealed default constants without changing the baseline constants.',
  },
] as const satisfies readonly MethodologyListItem[];

export const modeledItems = [
  {
    id: 'projection-window',
    label: 'Year-by-year projection window',
    description:
      'Projects from the current year through the plan end year, tracking annual balances, spending, income, withdrawals, taxes, and healthcare threshold effects.',
  },
  {
    id: 'inflation-indexing',
    label: 'Inflation and indexed assumptions',
    description:
      'The basic inflation rate is a single annual assumption used for spending growth, post-2026 federal bracket indexing, and FPL indexing.',
  },
  {
    id: 'account-buckets',
    label: 'Supported account buckets',
    description:
      'Tracks cash, taxable brokerage, traditional pre-tax accounts, Roth accounts, and HSA balances with one scenario-wide expected return per supported bucket.',
  },
  {
    id: 'withdrawal-order',
    label: 'Withdrawal order and advanced plan actions',
    description:
      'Uses the existing projection withdrawal order and supports current plan fields for annual spending overrides, Roth conversions, brokerage LTCG harvests, and auto-deplete brokerage schedules.',
  },
  {
    id: 'federal-tax',
    label: 'Federal tax stack',
    description:
      'Models ordinary income tax, long-term capital gain and qualified-dividend stacking, Social Security taxation, NIIT, self-employment tax, and the simplified QBI deduction.',
  },
  {
    id: 'healthcare-thresholds',
    label: 'ACA and Medicare threshold programs',
    description:
      'Models ACA premium tax credit exposure using ACA MAGI and FPL percentages, plus Medicare IRMAA surcharges using the MAGI lookback rules.',
  },
  {
    id: 'starter-state-tax',
    label: 'Starter state income tax',
    description:
      'Includes starter single-state models for Florida, Pennsylvania, and California, without multi-state allocation or residency logic.',
  },
  {
    id: 'income-streams',
    label: 'Recurring income streams',
    description:
      'Handles W-2 income, consulting income, simplified net rental income, Social Security benefits, pensions, and annuities as scenario inputs.',
  },
  {
    id: 'basis-and-dividends',
    label: 'Taxable brokerage basis and dividends',
    description:
      'Tracks taxable brokerage basis drift, realized long-term capital gains, planned harvests, and generated brokerage dividends under the current projection assumptions.',
  },
] as const satisfies readonly MethodologyListItem[];

export const notModeledItems = [
  {
    id: 'amt',
    label: 'AMT',
    designText: 'AMT (deferred to v1.5)',
    note: 'Alternative minimum tax remains outside the current engine and methodology page scope.',
  },
  {
    id: 'backdoor-mega-backdoor-roth',
    label: 'Backdoor and mega-backdoor Roth flows',
    designText: 'Backdoor / mega-backdoor Roth flows',
    note: 'The app can model explicit Roth conversions, but it does not model contribution mechanics or mega-backdoor plan rules.',
  },
  {
    id: 'inheritance-gifting-step-up',
    label: 'Inheritance, gifting, and step-up basis',
    designText: 'Inheritance / gifting / step-up basis',
    note: 'No estate, gifting, inherited-account, or stepped-up-basis logic is included.',
  },
  {
    id: 'multi-state',
    label: 'Multi-state residency and state allocation',
    designText: 'Multi-state residency / state allocation',
    note: 'The current model accepts one residence state and does not allocate income across states or localities.',
  },
  {
    id: 'trust-business-entity',
    label: 'Trust and business-entity income',
    designText: 'Trust / business-entity income (S-corp pass-through is not modeled separately)',
    note: 'Pass-through treatment is limited to the scoped consulting/QBI assumptions, not full entity modeling.',
  },
  {
    id: 'seventy-two-t-full',
    label: 'Full 72(t) three-method calculator',
    designText: '72(t) full 3-method calculator (deferred to v1.5)',
    note: 'Only the current fixed-amortization helper exists; the full IRS three-method SEPP calculator is deferred.',
  },
  {
    id: 'account-login-cloud-sync',
    label: 'Account login and cloud sync',
    designText: 'Account login / cloud sync (deliberately not building)',
    note: 'Financial data remains browser-local with no account system or server persistence.',
  },
  {
    id: 'global-roth-optimizer',
    label: 'Real-time global Roth-conversion optimizer',
    designText:
      'Real-time auto-optimizer that solves Roth conversion globally (Gate 4 targeter is constraint-driven, not a global optimizer)',
    note: 'Planner tools may probe one selected constraint, but the app does not solve a cross-year global optimum.',
  },
  {
    id: 'schedule-e-depreciation',
    label: 'Schedule E depreciation, passive-loss limits, and section 469 grouping',
    designText: 'Schedule E depreciation / passive-loss / section 469 grouping (only "net rental income" is taken as input)',
    note: 'Rental income is a simplified net input that flows into AGI/MAGI/NIIT; depreciation and passive-loss details are not calculated.',
  },
  {
    id: 'monte-carlo',
    label: 'Monte Carlo simulation',
    designText: 'Monte Carlo moves to v1.5, gated on all six fixture suites green.',
    note: 'The current app is deterministic and tax-threshold focused; simulation remains deferred until the tax math has earned that visual layer.',
  },
] as const satisfies readonly NotModeledItem[];

export const constantSourceRows = [
  {
    id: 'standard-deduction',
    name: '2026 federal standard deduction',
    value: `Single ${formatDollars(CONSTANTS_2026.federal.standardDeduction.single)}; MFJ ${formatDollars(
      CONSTANTS_2026.federal.standardDeduction.mfj,
    )}; HOH ${formatDollars(CONSTANTS_2026.federal.standardDeduction.hoh)}`,
    source: CONSTANTS_2026.federal.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.federal.source, CURATED_SOURCE_URLS.irsRevProc2025_32),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'ordinary-brackets',
    name: '2026 ordinary income brackets',
    value: `${CONSTANTS_2026.federal.ordinaryBrackets.single.map((bracket) => formatPercent(bracket.rate)).join(
      ', ',
    )} rates by filing status`,
    source: CONSTANTS_2026.federal.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.federal.source, CURATED_SOURCE_URLS.irsRevProc2025_32),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'senior-deduction',
    name: 'Temporary OBBBA senior deduction',
    value: `${formatDollars(CONSTANTS_2026.federal.seniorDeduction.perQualifiedIndividual)} per qualified individual, ${
      CONSTANTS_2026.federal.seniorDeduction.availableTaxYears.from
    }-${CONSTANTS_2026.federal.seniorDeduction.availableTaxYears.through}`,
    source: CONSTANTS_2026.federal.seniorDeduction.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.federal.seniorDeduction.source, CURATED_SOURCE_URLS.irsObbbaSenior),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'ltcg-brackets',
    name: '2026 long-term capital gain brackets',
    value: `${CONSTANTS_2026.ltcg.brackets.single.map((bracket) => formatPercent(bracket.rate)).join(
      ', ',
    )} rates with filing-status thresholds`,
    source: CONSTANTS_2026.ltcg.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.ltcg.source, CURATED_SOURCE_URLS.irsRevProc2025_32),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'niit',
    name: 'NIIT rate and MAGI thresholds',
    value: `${formatPercent(CONSTANTS_2026.niit.rate)} above ${formatDollars(
      CONSTANTS_2026.niit.magiThresholds.single,
    )} single / ${formatDollars(CONSTANTS_2026.niit.magiThresholds.mfj)} MFJ MAGI thresholds`,
    source: CONSTANTS_2026.niit.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.niit.source, CURATED_SOURCE_URLS.irsNiit),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'se-tax',
    name: 'Self-employment tax rates and wage base',
    value: `${formatPercent(CONSTANTS_2026.seTax.selfEmploymentRate)} SE tax; ${formatDollars(
      CONSTANTS_2026.seTax.ssWageBase,
    )} OASDI wage base`,
    source: CONSTANTS_2026.seTax.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.seTax.source, CURATED_SOURCE_URLS.irsScheduleSe2025),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'qbi',
    name: 'QBI deduction and phaseout bands',
    value: `${formatPercent(CONSTANTS_2026.qbi.deductionRate)} deduction rate; MFJ phaseout ${formatDollars(
      CONSTANTS_2026.qbi.phaseouts.mfj.start,
    )}-${formatDollars(CONSTANTS_2026.qbi.phaseouts.mfj.end)}`,
    source: CONSTANTS_2026.qbi.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.qbi.source, CURATED_SOURCE_URLS.irc199a),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'fpl-2026',
    name: '2026 Federal Poverty Level',
    value: `${formatDollars(CONSTANTS_2026.fpl.contiguous.householdSize[1])} contiguous household of 1; +${formatDollars(
      CONSTANTS_2026.fpl.contiguous.additionalPerPerson,
    )} per additional person`,
    source: CONSTANTS_2026.fpl.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.fpl.source, CURATED_SOURCE_URLS.hhsFpl2026),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'fpl-2025-aca',
    name: '2025 Federal Poverty Level used for 2026 ACA PTC',
    value: `${formatDollars(
      CONSTANTS_2026.fpl2025.contiguous.householdSize[1],
    )} contiguous household of 1; ACA coverage year ${CONSTANTS_2026.taxYear} uses FPL year ${
      CONSTANTS_2026.aca.premiumTaxCreditFplYear
    }`,
    source: CONSTANTS_2026.fpl2025.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.fpl2025.source, CURATED_SOURCE_URLS.hhsFpl2025),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'aca-applicable-percentages',
    name: 'ACA applicable percentage table',
    value: `${formatPercent(CONSTANTS_2026.aca.requiredContributionPercentage)} required contribution ceiling in the encoded table`,
    source: CONSTANTS_2026.aca.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.aca.source, CURATED_SOURCE_URLS.irsRevProc2025_25),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'irmaa',
    name: '2026 Medicare Part B premium and IRMAA tiers',
    value: `${formatDollars(CONSTANTS_2026.irmaa.standardPartBPremium)} standard Part B premium; ${
      CONSTANTS_2026.irmaa.lookbackYears
    }-year MAGI lookback`,
    source: CONSTANTS_2026.irmaa.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.irmaa.source, CURATED_SOURCE_URLS.cmsIrmaa2026),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
] as const satisfies readonly ConstantSourceRow[];

export const twoYearLagGotchas = [
  {
    id: 'aca-fpl-lag',
    label: 'ACA PTC uses prior-year FPL',
    description:
      'For 2026 coverage, the ACA premium tax credit calculation uses the 2025 FPL table. The constants encode this as aca.premiumTaxCreditFplYear = 2025.',
  },
  {
    id: 'irmaa-magi-lookback',
    label: 'IRMAA uses a two-year MAGI lookback',
    description:
      'Medicare IRMAA premiums for 2026 are assigned from 2024 MAGI. A Roth conversion in year T can affect IRMAA premiums in year T+2.',
  },
  {
    id: 'irmaa-history-fallback',
    label: 'IRMAA falls back when the primary lookback year is unavailable',
    description:
      'The IRMAA helper uses the two-year lookback when available and falls back one additional year when the primary lookback MAGI is missing.',
  },
  {
    id: 'aptc-repayment',
    label: 'Excess APTC is fully repayable for tax years after 2025',
    description:
      'The model does not apply pre-2026 repayment-cap tables. If projected MAGI pushes the credit too high, excess APTC is treated as fully repayable.',
  },
] as const satisfies readonly MethodologyListItem[];

export const metricMethodologyEntries = [
  { id: 'net-worth-at-retirement', kind: 'live-stat', sourceId: 'net-worth-at-retirement', explanation: liveStatExplanations['net-worth-at-retirement'] },
  { id: 'plan-end-balance', kind: 'live-stat', sourceId: 'plan-end-balance', explanation: liveStatExplanations['plan-end-balance'] },
  { id: 'years-funded', kind: 'live-stat', sourceId: 'years-funded', explanation: liveStatExplanations['years-funded'] },
  { id: 'average-bridge-magi', kind: 'live-stat', sourceId: 'average-bridge-magi', explanation: liveStatExplanations['average-bridge-magi'] },
  { id: 'max-bridge-draw-percentage', kind: 'live-stat', sourceId: 'max-bridge-draw-percentage', explanation: liveStatExplanations['max-bridge-draw-percentage'] },
  { id: 'total-bridge-tax', kind: 'live-stat', sourceId: 'total-bridge-tax', explanation: liveStatExplanations['total-bridge-tax'] },
  { id: 'agi', kind: 'table-column', sourceId: 'agi', explanation: columnExplanations.agi },
  { id: 'aca-magi', kind: 'table-column', sourceId: 'acaMagi', explanation: columnExplanations.acaMagi },
  { id: 'irmaa-magi', kind: 'table-column', sourceId: 'irmaaMagi', explanation: columnExplanations.irmaaMagi },
  { id: 'fpl-percentage', kind: 'table-column', sourceId: 'fplPercentage', explanation: columnExplanations.fplPercentage },
  { id: 'withdrawal-rate', kind: 'table-column', sourceId: 'withdrawalRate', explanation: columnExplanations.withdrawalRate },
  { id: 'brokerage-basis-remaining', kind: 'table-column', sourceId: 'brokerageBasisRemaining', explanation: columnExplanations.brokerageBasisRemaining },
  { id: 'total-tax', kind: 'table-column', sourceId: 'totalTax', explanation: columnExplanations.totalTax },
  { id: 'aca-premium-credit', kind: 'table-column', sourceId: 'acaPremiumCredit', explanation: columnExplanations.acaPremiumCredit },
  { id: 'irmaa-premium', kind: 'table-column', sourceId: 'irmaaPremium', explanation: columnExplanations.irmaaPremium },
] as const satisfies readonly MethodologyMetricEntry[];

export const caveatItems = [
  {
    id: 'educational-only',
    label: 'Educational estimate only',
    description:
      'Educational estimate only. Not tax, legal, investment, or filing advice. Do not make tax elections (Roth conversions, withdrawals, harvesting) from this output without verifying official IRS/state sources or a qualified professional.',
  },
  {
    id: 'current-law-snapshot',
    label: 'Constants are a dated current-law snapshot',
    description:
      'The sealed default constants are retrieved as of the displayed retrieval date. Later law changes, IRS guidance, or inflation-indexed updates can make outputs stale.',
  },
  {
    id: 'nominal-internals',
    label: 'Nominal-dollar internals',
    description:
      'Projection math runs in nominal dollars so indexed tax-law values and annual balances can be composed consistently. Real-dollar display is presentation only.',
  },
  {
    id: 'custom-law-overrides',
    label: 'Custom law changes are scenario-specific',
    description:
      'Advanced custom-law inputs are sparse scenario overrides layered over the sealed defaults; they do not mutate the default constants.',
  },
  {
    id: 'filing-software-boundary',
    label: 'Not filing software',
    description:
      'The model targets planning-level tax exposure and threshold awareness. It does not produce tax returns, forms, elections, safe-harbor advice, or audit-ready substantiation.',
  },
] as const satisfies readonly MethodologyListItem[];

export const sourceReferences = [
  {
    id: 'irs-rev-proc-2025-32',
    label: 'IRS Rev. Proc. 2025-32',
    source: CONSTANTS_2026.federal.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.federal.source, CURATED_SOURCE_URLS.irsRevProc2025_32),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'irs-rev-proc-2025-25',
    label: 'IRS Rev. Proc. 2025-25',
    source: CONSTANTS_2026.aca.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.aca.source, CURATED_SOURCE_URLS.irsRevProc2025_25),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'hhs-2026-fpl',
    label: 'HHS 2026 Poverty Guidelines',
    source: CONSTANTS_2026.fpl.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.fpl.source, CURATED_SOURCE_URLS.hhsFpl2026),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'hhs-2025-fpl',
    label: 'HHS 2025 Poverty Guidelines',
    source: CONSTANTS_2026.fpl2025.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.fpl2025.source, CURATED_SOURCE_URLS.hhsFpl2025),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'cms-irmaa-2026',
    label: 'CMS 2026 Medicare Parts A & B Premiums and Deductibles',
    source: CONSTANTS_2026.irmaa.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.irmaa.source, CURATED_SOURCE_URLS.cmsIrmaa2026),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'ssa-poms-irmaa-lookback',
    label: 'SSA POMS HI 01101.020',
    source: 'SSA POMS HI 01101.020, Medicare Part B IRMAA MAGI lookback evidence rules',
    sourceUrl: CURATED_SOURCE_URLS.ssaIrmaaLookback,
  },
  {
    id: 'irs-niit',
    label: 'IRS Net Investment Income Tax guidance',
    source: CONSTANTS_2026.niit.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.niit.source, CURATED_SOURCE_URLS.irsNiit),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
  {
    id: 'irs-senior-deduction',
    label: 'IRS OBBBA senior deduction guidance',
    source: CONSTANTS_2026.federal.seniorDeduction.source,
    sourceUrl: sourceUrlFrom(CONSTANTS_2026.federal.seniorDeduction.source, CURATED_SOURCE_URLS.irsObbbaSenior),
    retrievedAt: CONSTANTS_2026.retrievedAt,
  },
] as const satisfies readonly SourceReference[];

export const methodologySections = [
  {
    id: 'overview',
    title: "What this tool is and isn't",
    summary: 'A short statement of the product boundary before the detailed methodology.',
    paragraphs: overviewParagraphs,
  },
  {
    id: 'glossary',
    title: 'Glossary',
    summary: 'Plain-English definitions for the tax and planning terms used throughout the planner.',
    items: glossaryItems,
  },
  {
    id: 'modeled',
    title: 'What It Models',
    summary: 'The current engine composes supported account buckets, income streams, taxes, healthcare thresholds, and plan actions.',
    items: modeledItems,
  },
  {
    id: 'not-modeled',
    title: 'What It Does Not Model',
    summary: 'These exclusions are explicit v1 scope boundaries, not silent omissions.',
    notModeledItems,
  },
  {
    id: 'constants-source',
    title: 'Constants Used',
    summary: 'Default 2026 law constants are sealed in core and surfaced here with values, source URLs, and retrieval dates.',
    constantRows: constantSourceRows,
  },
  {
    id: 'two-year-lag',
    title: 'Two-Year Lag Gotchas',
    summary: 'ACA and Medicare threshold programs can depend on prior-year or prior-prior-year values.',
    items: twoYearLagGotchas,
  },
  {
    id: 'metrics',
    title: 'Metric Methodology',
    summary: 'Displayed methodology text reuses the same explanation entries as table headers and live-stat tooltips.',
    metricEntries: metricMethodologyEntries,
  },
  {
    id: 'caveats',
    title: 'Caveats',
    summary: 'Use outputs as planning estimates and verify important decisions against official sources or a qualified professional.',
    items: caveatItems,
  },
  {
    id: 'source-references',
    title: 'Source References',
    summary: 'Primary-source references used by the constants and methodology notes.',
    sourceReferences,
  },
] as const satisfies readonly MethodologySection[];
