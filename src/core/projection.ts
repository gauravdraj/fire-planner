/*
 * Gate 2 projection helpers and production multi-year engine.
 *
 * The projection engine keeps nominal-dollar internals and composes the pure tax
 * modules without importing UI, storage, network, or runtime I/O concerns.
 *
 * Brokerage sales use one weighted-average basis pool. Each taxable sale removes
 * basis in proportion to sale proceeds over account value; market returns change
 * account value but not basis. Generated taxable dividends are based on opening
 * brokerage balance and reinvested after tax, so taxable brokerage expected
 * return is interpreted as price appreciation when dividend yield is modeled.
 * This intentionally omits lot selection, wash sales, capital-loss limits, and
 * harvesting strategies.
 */

import { computeAutoDepleteSchedule } from './autoDepleteBrokerage';
import { CONSTANTS_2026 } from './constants/2026';
import { effectiveConstants, type CustomLaw, type LawConstants } from './constants/customLaw';
import { computeFederalTax, computeTaxableIncome } from './tax/federal';
import { computeLtcgTax } from './tax/ltcg';
import { computeAgi, computeMagiAca, computeMagiIrmaa } from './tax/magi';
import { computeNiit } from './tax/niit';
import { computeQbi, type QbiPhaseoutTable } from './tax/qbi';
import { flowToAgi, isRentalNiitEligible } from './tax/rentalE';
import { computeSeTax } from './tax/seTax';
import { computeTaxableSocialSecurity } from './tax/socialSecurity';
import { computeStateTax, type StateIncomeTaxLaw } from './tax/state';
import {
  computeAptcReconciliation,
  computePremiumTaxCredit,
  type AptcReconciliationResult,
  type FplHouseholdSizeTable,
  type FplRegion,
  type FplRegionTable,
  type FplTable,
  type PremiumTaxCreditResult,
} from './tax/aca';
import { computeIrmaa, type IrmaaResult } from './tax/irmaa';
import type { BracketTable, FilingStatus, LtcgBracketTable, MagiYear } from './types';

const BASE_INDEX_YEAR = 2026;
const FPL_HOUSEHOLD_SIZE_KEYS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const FPL_EDGE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', 'additionalPerPerson'] as const;

type FplHouseholdSizeKey = (typeof FPL_HOUSEHOLD_SIZE_KEYS)[number];
type FplIndexRow = Readonly<Record<`${FplHouseholdSizeKey}`, number> & { additionalPerPerson: number }>;

type IndexableBracketValue = object | readonly object[];

type IndexedBracketValue<TValue extends IndexableBracketValue> = TValue extends readonly (infer TBracket extends object)[]
  ? readonly TBracket[]
  : TValue;

export type IndexedBracketTable<TTable extends Readonly<Record<string, IndexableBracketValue>>> = {
  readonly [TStatus in keyof TTable]: IndexedBracketValue<TTable[TStatus]>;
};

export type AnnualAmount = Readonly<{
  year: number;
  amount: number;
}>;

export type W2ScheduleEntry = AnnualAmount;

export type ConsultingScheduleEntry = AnnualAmount &
  Readonly<{
    sstb: boolean;
    w2WagesAggregated?: number;
    ubiaAggregated?: number;
  }>;

export type SocialSecurityClaimAssumptions = Readonly<{
  claimYear: number;
  annualBenefit: number;
  colaRate?: number;
  isMfsLivingTogether?: boolean;
}>;

export type RentalScheduleEntry = AnnualAmount &
  Readonly<{
    cashFlow?: number;
    materiallyParticipates?: boolean;
  }>;

export type HealthcarePhase =
  | Readonly<{
      year: number;
      kind: 'none';
    }>
  | Readonly<{
      year: number;
      kind: 'aca';
      householdSize: number;
      annualBenchmarkPremium: number;
      annualEnrollmentPremium?: number;
      advancePremiumTaxCredit?: number;
      region?: FplRegion;
    }>
  | Readonly<{
      year: number;
      kind: 'medicare';
    }>;

export type AccountBalances = Readonly<{
  cash: number;
  hsa: number;
  taxableBrokerage: number;
  traditional: number;
  roth: number;
}>;

export type AccountReturns = Partial<AccountBalances>;

export type MortgageAssumptions = Readonly<{
  annualPI: number;
  payoffYear: number;
}>;

export type BrokerageDividendAssumptions = Readonly<{
  annualYield: number;
  qdiPercentage: number;
}>;

export type AutoDepleteBrokerageAssumptions = Readonly<{
  enabled: boolean;
  yearsToDeplete: number;
  annualScaleUpFactor: number;
  excludeMortgageFromRate: boolean;
  retirementYear?: number;
}>;

export type Scenario = Readonly<{
  startYear: number;
  filingStatus: FilingStatus;
  w2Income: readonly W2ScheduleEntry[];
  annualContributionTraditional: number;
  annualContributionRoth: number;
  annualContributionHsa: number;
  annualContributionBrokerage: number;
  consultingIncome: readonly ConsultingScheduleEntry[];
  healthcare: readonly HealthcarePhase[];
  socialSecurity?: SocialSecurityClaimAssumptions;
  pensionIncome: readonly AnnualAmount[];
  annuityIncome: readonly AnnualAmount[];
  rentalIncome: readonly RentalScheduleEntry[];
  state: Readonly<{
    incomeTaxLaw: StateIncomeTaxLaw;
    taxableIncomeSource?: 'federalTaxableIncome' | 'agi';
  }>;
  balances: AccountBalances;
  basis: Readonly<{
    taxableBrokerage: number;
  }>;
  inflationRate: number;
  expectedReturns: AccountReturns;
  mortgage?: MortgageAssumptions;
  brokerageDividends?: BrokerageDividendAssumptions;
  autoDepleteBrokerage?: AutoDepleteBrokerageAssumptions;
  magiHistory?: readonly MagiYear[];
  taxableInterest?: readonly AnnualAmount[];
  qualifiedDividends?: readonly AnnualAmount[];
  taxExemptInterest?: readonly AnnualAmount[];
  foreignEarnedIncomeExclusion?: readonly AnnualAmount[];
  otherIncome?: readonly AnnualAmount[];
  age65Plus?: boolean;
  partnerAge65Plus?: boolean;
  customLaw?: CustomLaw;
}>;

export type AnnualSpendingOverride = AnnualAmount;

export type RothConversion = AnnualAmount;

/**
 * Amount is the desired realized long-term capital gain from selling and
 * immediately rebuying taxable brokerage holdings.
 */
export type BrokerageHarvest = AnnualAmount;

export type WithdrawalPlan = Readonly<{
  endYear: number;
  annualSpending: readonly AnnualSpendingOverride[];
  rothConversions?: readonly RothConversion[];
  brokerageHarvests?: readonly BrokerageHarvest[];
}>;

export type BrokerageBasisBreakdown = Readonly<{
  opening: number;
  sold: number;
  realizedGainOrLoss: number;
  closing: number;
}>;

export type BrokerageDividendBreakdown = Readonly<{
  ordinary: number;
  qualified: number;
  total: number;
  afterTaxReinvested: number;
}>;

export type YearBreakdown = Readonly<{
  year: number;
  spending: number;
  openingBalances: AccountBalances;
  withdrawals: AccountBalances;
  conversions: number;
  brokerageHarvests: number;
  brokerageDividends?: BrokerageDividendBreakdown;
  gainsOrLosses: AccountBalances;
  brokerageBasis: BrokerageBasisBreakdown;
  agi: number;
  acaMagi: number;
  irmaaMagi: number;
  federalTax: number;
  stateTax: number;
  ltcgTax: number;
  niit: number;
  seTax: number;
  qbiDeduction: number;
  taxableSocialSecurity: number;
  acaPremiumCredit: PremiumTaxCreditResult | null;
  aptcReconciliation: AptcReconciliationResult | null;
  irmaaPremium: IrmaaResult | null;
  totalTax: number;
  afterTaxCashFlow: number;
  warnings: readonly string[];
  closingBalances: AccountBalances;
}>;

type WithdrawalAllocation = Readonly<{
  withdrawals: AccountBalances;
  taxableBrokerageBasisSold: number;
  taxableBrokerageGainOrLoss: number;
  remainingNeed: number;
  balancesAfterWithdrawals: AccountBalances;
  taxableBrokerageBasisAfterSale: number;
}>;

type BrokerageHarvestAllocation = Readonly<{
  basisSold: number;
  realizedGain: number;
  basisAfterHarvest: number;
  unharvestedGain: number;
}>;

type AnnualContributions = Readonly<{
  traditional: number;
  roth: number;
  hsa: number;
  taxableBrokerage: number;
  total: number;
  pretax: number;
}>;

type YearComputation = Readonly<{
  breakdown: YearBreakdown;
  closingBrokerageBasis: number;
  cashIncomeBeforeWithdrawals: number;
  healthcarePremiumOutflow: number;
  spendableCashTax: number;
}>;

type YearTaxComputation = Readonly<{
  taxableSocialSecurity: number;
  agi: number;
  acaMagi: number;
  irmaaMagi: number;
  federalTax: number;
  stateTax: number;
  ltcgTax: number;
  niit: number;
  seTax: ReturnType<typeof computeSeTax>;
  qbiDeduction: number;
  acaPremiumCredit: PremiumTaxCreditResult | null;
  aptcReconciliation: AptcReconciliationResult | null;
  irmaaPremium: IrmaaResult | null;
  healthcarePremiumOutflow: number;
  totalTax: number;
}>;

function getIndexMultiplier(taxYear: number, inflationRate: number): number {
  if (taxYear <= BASE_INDEX_YEAR) {
    return 1;
  }

  return (1 + inflationRate) ** (taxYear - BASE_INDEX_YEAR);
}

function roundToWholeDollars(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const dollars = Math.trunc(Math.abs(value) + 0.5 + Number.EPSILON);

  return sign * dollars;
}

function indexBracket<TBracket extends object>(
  bracket: TBracket,
  multiplier: number,
  edgeKeys: readonly string[],
): TBracket {
  const indexed = { ...bracket } as Record<string, unknown>;

  for (const edgeKey of edgeKeys) {
    if (!(edgeKey in indexed)) {
      throw new Error(`Projection bracket edge "${edgeKey}" is missing`);
    }

    const edge = indexed[edgeKey];
    if (typeof edge !== 'number' || !Number.isFinite(edge)) {
      throw new Error(`Projection bracket edge "${edgeKey}" must be a finite number`);
    }

    indexed[edgeKey] = edge * multiplier;
  }

  return indexed as TBracket;
}

function indexBracketValue<TValue extends IndexableBracketValue>(
  value: TValue,
  multiplier: number,
  edgeKeys: readonly string[],
): IndexedBracketValue<TValue> {
  if (Array.isArray(value)) {
    return value.map((bracket) => indexBracket(bracket, multiplier, edgeKeys)) as IndexedBracketValue<TValue>;
  }

  return indexBracket(value, multiplier, edgeKeys) as IndexedBracketValue<TValue>;
}

export function indexBracketsForYear<TTable extends Readonly<Record<string, IndexableBracketValue>>>(
  brackets: TTable,
  taxYear: number,
  inflationRate: number,
  edgeKeys: readonly string[] = ['from'],
): IndexedBracketTable<TTable> {
  const multiplier = getIndexMultiplier(taxYear, inflationRate);
  const indexedEntries = Object.entries(brackets).map(([status, value]) => [
    status,
    indexBracketValue(value, multiplier, edgeKeys),
  ]);

  return Object.fromEntries(indexedEntries) as IndexedBracketTable<TTable>;
}

function flattenFplRegion(region: FplRegionTable): FplIndexRow {
  return {
    1: region.householdSize[1],
    2: region.householdSize[2],
    3: region.householdSize[3],
    4: region.householdSize[4],
    5: region.householdSize[5],
    6: region.householdSize[6],
    7: region.householdSize[7],
    8: region.householdSize[8],
    additionalPerPerson: region.additionalPerPerson,
  };
}

function expandFplRegion(region: FplIndexRow): FplRegionTable {
  const householdSize = Object.fromEntries(
    FPL_HOUSEHOLD_SIZE_KEYS.map((size) => [size, roundToWholeDollars(region[size])]),
  ) as Record<FplHouseholdSizeKey, number>;

  return {
    householdSize: householdSize as FplHouseholdSizeTable,
    additionalPerPerson: roundToWholeDollars(region.additionalPerPerson),
  };
}

export function indexFplTableForYear(baseTable: FplTable, targetFplYear: number, fplIndexingRate: number): FplTable {
  const indexedRegions = indexBracketsForYear(
    {
      contiguous: flattenFplRegion(baseTable.contiguous),
      alaska: flattenFplRegion(baseTable.alaska),
      hawaii: flattenFplRegion(baseTable.hawaii),
    },
    targetFplYear,
    fplIndexingRate,
    FPL_EDGE_KEYS,
  );

  return {
    year: targetFplYear,
    source: `${baseTable.source}; indexed from ${baseTable.year} for projection years`,
    retrievedAt: baseTable.retrievedAt,
    contiguous: expandFplRegion(indexedRegions.contiguous),
    alaska: expandFplRegion(indexedRegions.alaska),
    hawaii: expandFplRegion(indexedRegions.hawaii),
    indexedFromYear: baseTable.year,
    indexingRate: fplIndexingRate,
  };
}

export function runProjection(scenario: Scenario, plan: WithdrawalPlan): YearBreakdown[] {
  if (plan.endYear < scenario.startYear) {
    throw new Error('Projection plan endYear must be at least the scenario startYear');
  }

  const constants = effectiveConstants(scenario);
  const results: YearBreakdown[] = [];
  let balances = copyBalances(scenario.balances);
  let taxableBrokerageBasis = roundToCents(Math.max(0, scenario.basis.taxableBrokerage));
  const magiHistory: MagiYear[] = [...(scenario.magiHistory ?? [])];
  const contributionRetirementYear = inferContributionRetirementYear(scenario, plan);

  for (let year = scenario.startYear; year <= plan.endYear; year += 1) {
    let withdrawalTarget = Math.max(0, computeCashNeedBeforeTax(scenario, plan, year));
    let computation = computeProjectionYear(
      scenario,
      plan,
      constants,
      year,
      balances,
      taxableBrokerageBasis,
      magiHistory,
      withdrawalTarget,
      contributionRetirementYear,
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const nextWithdrawalTarget = Math.max(
        0,
        computation.breakdown.spending +
          computation.healthcarePremiumOutflow +
          Math.max(0, computation.spendableCashTax) -
          computation.cashIncomeBeforeWithdrawals,
      );

      if (Math.abs(nextWithdrawalTarget - withdrawalTarget) < 0.01) {
        break;
      }

      withdrawalTarget = nextWithdrawalTarget;
      computation = computeProjectionYear(
        scenario,
        plan,
        constants,
        year,
        balances,
        taxableBrokerageBasis,
        magiHistory,
        withdrawalTarget,
        contributionRetirementYear,
      );
    }

    results.push(computation.breakdown);
    balances = computation.breakdown.closingBalances;
    taxableBrokerageBasis = computation.closingBrokerageBasis;
    magiHistory.push({ year, magi: computation.breakdown.irmaaMagi });
  }

  return results;
}

function computeProjectionYear(
  scenario: Scenario,
  plan: WithdrawalPlan,
  constants: LawConstants,
  year: number,
  openingBalances: AccountBalances,
  openingBrokerageBasis: number,
  magiHistory: readonly MagiYear[],
  withdrawalTarget: number,
  contributionRetirementYear: number,
): YearComputation {
  const spending = nonnegative(sumAnnualAmounts(plan.annualSpending, year)) + mortgagePAndIBeforePayoff(scenario, year);
  const warnings: string[] = [];
  const contributions = contributionsForYear(scenario, year, contributionRetirementYear);
  const autoDepleteWithdrawal = autoDepleteBrokerageWithdrawal(scenario, year);
  const allocation = allocateWithdrawals(openingBalances, openingBrokerageBasis, withdrawalTarget, autoDepleteWithdrawal);
  const plannedBrokerageHarvest = nonnegative(sumAnnualAmounts(plan.brokerageHarvests ?? [], year));
  const brokerageHarvest = allocateBrokerageHarvest(
    allocation.balancesAfterWithdrawals.taxableBrokerage,
    allocation.taxableBrokerageBasisAfterSale,
    plannedBrokerageHarvest,
  );
  const taxableBrokerageGainOrLoss = roundToCents(
    allocation.taxableBrokerageGainOrLoss + brokerageHarvest.realizedGain,
  );
  const plannedConversion = nonnegative(sumAnnualAmounts(plan.rothConversions ?? [], year));
  const conversion = Math.min(plannedConversion, allocation.balancesAfterWithdrawals.traditional);
  const balancesAfterConversion: AccountBalances = {
    cash: allocation.balancesAfterWithdrawals.cash,
    hsa: allocation.balancesAfterWithdrawals.hsa,
    taxableBrokerage: allocation.balancesAfterWithdrawals.taxableBrokerage,
    traditional: roundToCents(allocation.balancesAfterWithdrawals.traditional - conversion),
    roth: roundToCents(allocation.balancesAfterWithdrawals.roth + conversion),
  };
  const balancesAfterContributions: AccountBalances = {
    cash: balancesAfterConversion.cash,
    hsa: roundToCents(balancesAfterConversion.hsa + contributions.hsa),
    taxableBrokerage: roundToCents(balancesAfterConversion.taxableBrokerage + contributions.taxableBrokerage),
    traditional: roundToCents(balancesAfterConversion.traditional + contributions.traditional),
    roth: roundToCents(balancesAfterConversion.roth + contributions.roth),
  };

  if (allocation.remainingNeed > 0) {
    warnings.push(`Withdrawal need exceeded available account balances by ${formatDollars(allocation.remainingNeed)}.`);
  }
  if (plannedConversion > conversion) {
    warnings.push(`Planned Roth conversion exceeded remaining traditional balance by ${formatDollars(plannedConversion - conversion)}.`);
  }
  if (brokerageHarvest.unharvestedGain > 0) {
    warnings.push(
      `Planned brokerage harvest exceeded remaining unrealized gain by ${formatDollars(brokerageHarvest.unharvestedGain)}.`,
    );
  }

  const wages = sumAnnualAmounts(scenario.w2Income, year);
  const taxableWages = roundToCents(Math.max(0, wages - contributions.pretax));
  const consultingEntries = entriesForYear(scenario.consultingIncome, year);
  const consultingIncome = consultingEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const hasSstbConsulting = consultingEntries.some((entry) => entry.amount > 0 && entry.sstb);
  const hasNonSstbConsulting = consultingEntries.some((entry) => entry.amount > 0 && !entry.sstb);
  const consultingW2Wages = consultingEntries.reduce((sum, entry) => sum + nonnegative(entry.w2WagesAggregated ?? 0), 0);
  const consultingUbia = consultingEntries.reduce((sum, entry) => sum + nonnegative(entry.ubiaAggregated ?? 0), 0);

  if (hasSstbConsulting && hasNonSstbConsulting) {
    warnings.push('Mixed SSTB and non-SSTB consulting income is aggregated with SSTB phaseout treatment.');
  }

  const pensionIncome = sumAnnualAmounts(scenario.pensionIncome, year);
  const annuityIncome = sumAnnualAmounts(scenario.annuityIncome, year);
  const taxableInterest = sumAnnualAmounts(scenario.taxableInterest ?? [], year);
  const staticQualifiedDividends = sumAnnualAmounts(scenario.qualifiedDividends ?? [], year);
  const generatedBrokerageDividends = computeGeneratedBrokerageDividends(
    openingBalances.taxableBrokerage,
    scenario.brokerageDividends,
  );
  const qualifiedDividends = roundToCents(staticQualifiedDividends + generatedBrokerageDividends.qualified);
  const taxExemptInterest = nonnegative(sumAnnualAmounts(scenario.taxExemptInterest ?? [], year));
  const foreignEarnedIncomeExclusion = nonnegative(sumAnnualAmounts(scenario.foreignEarnedIncomeExclusion ?? [], year));
  const otherIncome = sumAnnualAmounts(scenario.otherIncome ?? [], year);
  const socialSecurityBenefits = computeSocialSecurityBenefit(scenario.socialSecurity, year);
  const rentalEntries = entriesForYear(scenario.rentalIncome, year);
  const rentalNetIncome = rentalEntries.reduce((sum, entry) => sum + flowToAgi({ netRentalIncome: entry.amount }), 0);
  const rentalCashFlow = rentalEntries.reduce((sum, entry) => sum + (entry.cashFlow ?? entry.amount), 0);
  const passiveRentalNetIncome = rentalEntries.reduce((sum, entry) => {
    return isRentalNiitEligible({ netRentalIncome: entry.amount }, entry.materiallyParticipates === true)
      ? sum + Math.max(0, entry.amount)
      : sum;
  }, 0);

  function computeYearTax(ordinaryGeneratedDividends: number, totalQualifiedDividends: number): YearTaxComputation {
    const socialSecurityInput: Parameters<typeof computeTaxableSocialSecurity>[0] = {
      filingStatus: scenario.filingStatus,
      grossSocialSecurityBenefits: nonnegative(socialSecurityBenefits),
      otherIncomeBeforeSocialSecurity:
        taxableWages +
        consultingIncome +
        pensionIncome +
        annuityIncome +
        taxableInterest +
        ordinaryGeneratedDividends +
        totalQualifiedDividends +
        taxableBrokerageGainOrLoss +
        allocation.withdrawals.traditional +
        conversion +
        rentalNetIncome +
        otherIncome,
      taxExemptInterest,
    };
    if (scenario.socialSecurity?.isMfsLivingTogether !== undefined) {
      socialSecurityInput.isMfsLivingTogether = scenario.socialSecurity.isMfsLivingTogether;
    }
    const taxableSocialSecurity = computeTaxableSocialSecurity(socialSecurityInput).taxableAmount;

    const seTax = computeSeTax({
      filingStatus: scenario.filingStatus,
      netSeIncome: consultingIncome,
      totalMedicareWages: nonnegative(wages),
      w2WagesSubjectToSs: nonnegative(wages),
    });

    const agi = computeAgi({
      wages: taxableWages,
      netSelfEmploymentIncome: consultingIncome,
      pensions: pensionIncome + annuityIncome,
      taxableSocialSecurity,
      iraDistributions: allocation.withdrawals.traditional,
      rothConversions: conversion,
      taxableBrokerageIncome: taxableInterest + ordinaryGeneratedDividends,
      capitalGains: totalQualifiedDividends + taxableBrokerageGainOrLoss,
      rentalNetIncome,
      otherIncome,
      seDeductibleHalf: seTax.deductibleHalf,
    });
    const acaMagi = computeMagiAca({
      agi,
      taxExemptInterest,
      nonTaxableSocialSecurityBenefits: Math.max(0, socialSecurityBenefits - taxableSocialSecurity),
      foreignEarnedIncomeExclusion,
    });
    const irmaaMagi = computeMagiIrmaa({ agi, taxExemptInterest });

    const taxableIncomeOptions: Parameters<typeof computeTaxableIncome>[2] = {
      magi: irmaaMagi,
      standardDeduction: constants.federal.standardDeduction,
    };
    if (scenario.age65Plus !== undefined) {
      taxableIncomeOptions.age65Plus = scenario.age65Plus;
    }
    if (scenario.partnerAge65Plus !== undefined) {
      taxableIncomeOptions.partnerAge65Plus = scenario.partnerAge65Plus;
    }

    const taxableIncomeBeforeQbi = computeTaxableIncome(agi, scenario.filingStatus, taxableIncomeOptions);
    const preferentialIncome = Math.max(0, totalQualifiedDividends + Math.max(0, taxableBrokerageGainOrLoss));
    const qbiDeduction = computeQbi({
      filingStatus: scenario.filingStatus,
      qbiNetIncome: consultingIncome,
      sstb: hasSstbConsulting,
      taxableIncomeBeforeQbi,
      netCapitalGains: preferentialIncome,
      w2WagesAggregated: consultingW2Wages,
      ubiaAggregated: consultingUbia,
      phaseouts: indexBracketsForYear(
        CONSTANTS_2026.qbi.phaseouts,
        year,
        scenario.inflationRate,
        ['start', 'end'],
      ) as QbiPhaseoutTable,
    });
    const taxableIncome = roundToCents(Math.max(0, taxableIncomeBeforeQbi - qbiDeduction));
    const preferentialTaxableIncome = Math.min(preferentialIncome, taxableIncome);
    const ordinaryTaxableIncome = roundToCents(Math.max(0, taxableIncome - preferentialTaxableIncome));
    const indexedOrdinaryBrackets = indexBracketsForYear(
      constants.federal.ordinaryBrackets,
      year,
      scenario.inflationRate,
    ) as BracketTable;
    const indexedLtcgBrackets = indexBracketsForYear(
      constants.ltcg.brackets,
      year,
      scenario.inflationRate,
    ) as LtcgBracketTable;
    const federalTax = computeFederalTax(ordinaryTaxableIncome, scenario.filingStatus, indexedOrdinaryBrackets);
    const ltcgTax = computeLtcgTax({
      filingStatus: scenario.filingStatus,
      ordinaryTaxableIncome,
      ltcgAndQdiv: preferentialTaxableIncome,
      brackets: indexedLtcgBrackets,
    }).ltcgTax;
    const niit = computeNiit({
      filingStatus: scenario.filingStatus,
      magiForNiit: agi,
      netInvestmentIncome:
        taxableInterest +
        ordinaryGeneratedDividends +
        totalQualifiedDividends +
        Math.max(0, taxableBrokerageGainOrLoss) +
        passiveRentalNetIncome,
      rate: constants.niit.rate,
    });
    const stateTaxableIncome = scenario.state.taxableIncomeSource === 'agi' ? agi : taxableIncome;
    const stateTax = computeStateTax({
      law: scenario.state.incomeTaxLaw,
      filingStatus: scenario.filingStatus,
      taxableIncome: stateTaxableIncome,
    });

    const healthcarePhase = getHealthcarePhase(scenario.healthcare, year);
    let acaPremiumCredit: PremiumTaxCreditResult | null = null;
    if (healthcarePhase.kind === 'aca') {
      const premiumTaxCreditInput: Parameters<typeof computePremiumTaxCredit>[0] = {
        coverageYear: year,
        householdIncome: acaMagi,
        householdSize: healthcarePhase.householdSize,
        annualBenchmarkPremium: healthcarePhase.annualBenchmarkPremium,
        fplIndexingRate: scenario.inflationRate,
        ...(healthcarePhase.annualEnrollmentPremium !== undefined
          ? { annualEnrollmentPremium: healthcarePhase.annualEnrollmentPremium }
          : {}),
        ...(healthcarePhase.region !== undefined ? { region: healthcarePhase.region } : {}),
      };
      acaPremiumCredit = computePremiumTaxCredit(premiumTaxCreditInput);
    }
    const aptcReconciliation = healthcarePhase.kind === 'aca' && acaPremiumCredit !== null
      ? computeAptcReconciliation({
          coverageYear: year,
          allowedPremiumTaxCredit: acaPremiumCredit.premiumTaxCredit,
          advancePremiumTaxCredit: nonnegative(healthcarePhase.advancePremiumTaxCredit ?? 0),
        })
      : null;
    const irmaaPremium = healthcarePhase.kind === 'medicare'
      ? computeIrmaa({
          premiumYear: year,
          filingStatus: scenario.filingStatus,
          magiHistory,
        })
      : null;
    const healthcarePremiumOutflow = roundToCents(irmaaPremium?.annualIrmaaSurcharge ?? 0);
    const totalTax = roundToCents(
      federalTax +
        ltcgTax +
        seTax.totalSeTax +
        niit +
        stateTax -
        (aptcReconciliation?.netPremiumTaxCredit ?? 0) +
        (aptcReconciliation?.repaymentAmount ?? 0),
    );

    return {
      taxableSocialSecurity,
      agi,
      acaMagi,
      irmaaMagi,
      federalTax,
      stateTax,
      ltcgTax,
      niit,
      seTax,
      qbiDeduction,
      acaPremiumCredit,
      aptcReconciliation,
      irmaaPremium,
      healthcarePremiumOutflow,
      totalTax,
    };
  }

  const taxComputation = computeYearTax(generatedBrokerageDividends.ordinary, qualifiedDividends);
  const taxWithoutGeneratedBrokerageDividends =
    generatedBrokerageDividends.total > 0
      ? computeYearTax(0, staticQualifiedDividends)
      : taxComputation;
  const generatedDividendTax = roundToCents(
    Math.min(
      generatedBrokerageDividends.total,
      Math.max(0, taxComputation.totalTax - taxWithoutGeneratedBrokerageDividends.totalTax),
    ),
  );
  const afterTaxGeneratedDividendReinvestment = roundToCents(generatedBrokerageDividends.total - generatedDividendTax);
  const spendableCashTax = roundToCents(taxComputation.totalTax - generatedDividendTax);
  const healthcarePhase = getHealthcarePhase(scenario.healthcare, year);

  if (healthcarePhase.kind === 'aca' && taxableBrokerageGainOrLoss > 0) {
    warnings.push(
      `Taxable brokerage activity created ${formatDollars(taxableBrokerageGainOrLoss)} of realized gain included in ACA MAGI.`,
    );
  }
  if (
    taxComputation.acaPremiumCredit !== null &&
    !taxComputation.acaPremiumCredit.isEligible &&
    taxComputation.acaPremiumCredit.fplPercent > 4
  ) {
    warnings.push('ACA MAGI is above 400% FPL, so the projected premium tax credit is zero.');
  }

  const cashIncomeBeforeWithdrawals =
    wages +
    consultingIncome +
    pensionIncome +
    annuityIncome +
    taxableInterest +
    staticQualifiedDividends +
    socialSecurityBenefits +
    rentalCashFlow +
    otherIncome;
  const afterTaxCashFlow = roundToCents(
    cashIncomeBeforeWithdrawals +
      sumBalanceAmounts(allocation.withdrawals) -
      spending -
      taxComputation.healthcarePremiumOutflow -
      spendableCashTax -
      contributions.total,
  );

  if (afterTaxCashFlow < -0.01) {
    warnings.push(`After-tax cash flow is short by ${formatDollars(Math.abs(afterTaxCashFlow))}.`);
  }

  const returns = applyExpectedReturns(balancesAfterContributions, scenario.expectedReturns, warnings, {
    ...balancesAfterContributions,
    hsa: roundToCents(openingBalances.hsa + contributions.hsa),
  });
  const closingBrokerageBasis = roundToCents(
    brokerageHarvest.basisAfterHarvest + contributions.taxableBrokerage + afterTaxGeneratedDividendReinvestment,
  );
  const closingBalances = {
    ...returns.closingBalances,
    cash: roundToCents(returns.closingBalances.cash + Math.max(0, afterTaxCashFlow)),
    taxableBrokerage: roundToCents(
      returns.closingBalances.taxableBrokerage + afterTaxGeneratedDividendReinvestment,
    ),
  };

  return {
    breakdown: {
      year,
      spending,
      openingBalances: copyBalances(openingBalances),
      withdrawals: allocation.withdrawals,
      conversions: roundToCents(conversion),
      brokerageHarvests: roundToCents(brokerageHarvest.realizedGain),
      brokerageDividends: {
        ordinary: generatedBrokerageDividends.ordinary,
        qualified: generatedBrokerageDividends.qualified,
        total: generatedBrokerageDividends.total,
        afterTaxReinvested: afterTaxGeneratedDividendReinvestment,
      },
      gainsOrLosses: returns.gainsOrLosses,
      brokerageBasis: {
        opening: roundToCents(openingBrokerageBasis),
        sold: roundToCents(allocation.taxableBrokerageBasisSold + brokerageHarvest.basisSold),
        realizedGainOrLoss: taxableBrokerageGainOrLoss,
        closing: closingBrokerageBasis,
      },
      agi: taxComputation.agi,
      acaMagi: taxComputation.acaMagi,
      irmaaMagi: taxComputation.irmaaMagi,
      federalTax: taxComputation.federalTax,
      stateTax: taxComputation.stateTax,
      ltcgTax: taxComputation.ltcgTax,
      niit: taxComputation.niit,
      seTax: taxComputation.seTax.totalSeTax,
      qbiDeduction: taxComputation.qbiDeduction,
      taxableSocialSecurity: taxComputation.taxableSocialSecurity,
      acaPremiumCredit: taxComputation.acaPremiumCredit,
      aptcReconciliation: taxComputation.aptcReconciliation,
      irmaaPremium: taxComputation.irmaaPremium,
      totalTax: taxComputation.totalTax,
      afterTaxCashFlow,
      warnings,
      closingBalances,
    },
    closingBrokerageBasis,
    cashIncomeBeforeWithdrawals: roundToCents(cashIncomeBeforeWithdrawals),
    healthcarePremiumOutflow: taxComputation.healthcarePremiumOutflow,
    spendableCashTax,
  };
}

function computeCashNeedBeforeTax(scenario: Scenario, plan: WithdrawalPlan, year: number): number {
  const socialSecurityBenefits = computeSocialSecurityBenefit(scenario.socialSecurity, year);
  const rentalCashFlow = entriesForYear(scenario.rentalIncome, year).reduce(
    (sum, entry) => sum + (entry.cashFlow ?? entry.amount),
    0,
  );
  const cashIncome =
    sumAnnualAmounts(scenario.w2Income, year) +
    sumAnnualAmounts(scenario.consultingIncome, year) +
    sumAnnualAmounts(scenario.pensionIncome, year) +
    sumAnnualAmounts(scenario.annuityIncome, year) +
    sumAnnualAmounts(scenario.taxableInterest ?? [], year) +
    sumAnnualAmounts(scenario.qualifiedDividends ?? [], year) +
    socialSecurityBenefits +
    rentalCashFlow +
    sumAnnualAmounts(scenario.otherIncome ?? [], year);

  return nonnegative(sumAnnualAmounts(plan.annualSpending, year)) + mortgagePAndIBeforePayoff(scenario, year) - cashIncome;
}

function inferContributionRetirementYear(scenario: Scenario, plan: WithdrawalPlan): number {
  const configuredRetirementYear = scenario.autoDepleteBrokerage?.retirementYear;
  if (typeof configuredRetirementYear === 'number' && Number.isFinite(configuredRetirementYear)) {
    return Math.trunc(configuredRetirementYear);
  }

  const activeIncomeYears = [
    ...positiveAnnualYears(scenario.w2Income),
    ...positiveAnnualYears(scenario.consultingIncome),
  ].filter((activeYear) => activeYear >= scenario.startYear && activeYear <= plan.endYear);

  if (activeIncomeYears.length > 0) {
    return Math.max(...activeIncomeYears) + 1;
  }

  return firstPositiveAnnualYear([...scenario.pensionIncome, ...scenario.annuityIncome]) ?? scenario.startYear;
}

function contributionsForYear(scenario: Scenario, year: number, retirementYear: number): AnnualContributions {
  if (year >= retirementYear) {
    return {
      traditional: 0,
      roth: 0,
      hsa: 0,
      taxableBrokerage: 0,
      total: 0,
      pretax: 0,
    };
  }

  const traditional = roundToCents(nonnegative(scenario.annualContributionTraditional));
  const roth = roundToCents(nonnegative(scenario.annualContributionRoth));
  const hsa = roundToCents(nonnegative(scenario.annualContributionHsa));
  const taxableBrokerage = roundToCents(nonnegative(scenario.annualContributionBrokerage));
  const total = roundToCents(traditional + roth + hsa + taxableBrokerage);
  const pretax = roundToCents(traditional + hsa);

  return {
    traditional,
    roth,
    hsa,
    taxableBrokerage,
    total,
    pretax,
  };
}

function mortgagePAndIBeforePayoff(scenario: Scenario, year: number): number {
  const annualPI = nonnegative(scenario.mortgage?.annualPI);
  const payoffYear = scenario.mortgage?.payoffYear;

  if (annualPI <= 0 || payoffYear === undefined || !Number.isFinite(payoffYear) || year > payoffYear) {
    return 0;
  }

  return roundToCents(annualPI);
}

function computeGeneratedBrokerageDividends(
  openingTaxableBrokerage: number,
  assumptions: BrokerageDividendAssumptions | undefined,
): BrokerageDividendBreakdown {
  const annualYield = nonnegative(assumptions?.annualYield);
  const qdiPercentage = clampPercentage(assumptions?.qdiPercentage ?? 0);
  const total = roundToCents(nonnegative(openingTaxableBrokerage) * annualYield);
  const qualified = roundToCents(total * qdiPercentage);
  const ordinary = roundToCents(total - qualified);

  return {
    ordinary,
    qualified,
    total,
    afterTaxReinvested: total,
  };
}

function autoDepleteBrokerageWithdrawal(scenario: Scenario, year: number): number {
  const assumptions = scenario.autoDepleteBrokerage;
  if (assumptions?.enabled !== true) {
    return 0;
  }

  const yearsToDeplete = Number.isFinite(assumptions.yearsToDeplete)
    ? Math.max(0, Math.trunc(assumptions.yearsToDeplete))
    : 0;
  if (yearsToDeplete <= 0) {
    return 0;
  }

  const retirementYear = assumptions.retirementYear;
  const configuredRetirementYear =
    typeof retirementYear === 'number' && Number.isFinite(retirementYear) ? retirementYear : scenario.startYear;
  const scheduleStartYear = Math.max(scenario.startYear, Math.trunc(configuredRetirementYear));
  const scheduleIndex = year - scheduleStartYear;
  if (scheduleIndex < 0 || scheduleIndex >= yearsToDeplete) {
    return 0;
  }

  const schedule = computeAutoDepleteSchedule(
    scenario.balances.taxableBrokerage,
    yearsToDeplete,
    assumptions.annualScaleUpFactor,
    scenario.expectedReturns.taxableBrokerage ?? 0,
  );

  return nonnegative(schedule[scheduleIndex]);
}

function allocateWithdrawals(
  openingBalances: AccountBalances,
  openingBrokerageBasis: number,
  withdrawalTarget: number,
  forcedTaxableBrokerageWithdrawal = 0,
): WithdrawalAllocation {
  const forcedTaxableBrokerage = withdrawFromAccount(
    openingBalances.taxableBrokerage,
    nonnegative(forcedTaxableBrokerageWithdrawal),
  );
  let remainingNeed = roundToCents(nonnegative(withdrawalTarget) - forcedTaxableBrokerage);
  const cash = withdrawFromAccount(openingBalances.cash, remainingNeed);
  remainingNeed = roundToCents(remainingNeed - cash);
  // Phase 1A assumes HSA withdrawals are qualified medical withdrawals: tax-free
  // and available before taxable brokerage in the default spending allocator.
  const hsa = withdrawFromAccount(openingBalances.hsa, remainingNeed);
  remainingNeed = roundToCents(remainingNeed - hsa);
  const additionalTaxableBrokerage = withdrawFromAccount(
    Math.max(0, openingBalances.taxableBrokerage - forcedTaxableBrokerage),
    remainingNeed,
  );
  const taxableBrokerage = roundToCents(forcedTaxableBrokerage + additionalTaxableBrokerage);
  remainingNeed = roundToCents(remainingNeed - additionalTaxableBrokerage);
  const traditional = withdrawFromAccount(openingBalances.traditional, remainingNeed);
  remainingNeed = roundToCents(remainingNeed - traditional);
  const roth = withdrawFromAccount(openingBalances.roth, remainingNeed);
  remainingNeed = roundToCents(remainingNeed - roth);

  const basisRatio = openingBalances.taxableBrokerage > 0 ? openingBrokerageBasis / openingBalances.taxableBrokerage : 0;
  const taxableBrokerageBasisSold = taxableBrokerage * basisRatio;
  const taxableBrokerageBasisAfterSale = Math.max(0, openingBrokerageBasis - taxableBrokerageBasisSold);

  return {
    withdrawals: {
      cash: roundToCents(cash),
      hsa: roundToCents(hsa),
      taxableBrokerage,
      traditional: roundToCents(traditional),
      roth: roundToCents(roth),
    },
    taxableBrokerageBasisSold: roundToCents(taxableBrokerageBasisSold),
    taxableBrokerageGainOrLoss: roundToCents(taxableBrokerage - taxableBrokerageBasisSold),
    remainingNeed: roundToCents(remainingNeed),
    balancesAfterWithdrawals: {
      cash: roundToCents(openingBalances.cash - cash),
      hsa: roundToCents(openingBalances.hsa - hsa),
      taxableBrokerage: roundToCents(openingBalances.taxableBrokerage - taxableBrokerage),
      traditional: roundToCents(openingBalances.traditional - traditional),
      roth: roundToCents(openingBalances.roth - roth),
    },
    taxableBrokerageBasisAfterSale: roundToCents(taxableBrokerageBasisAfterSale),
  };
}

function allocateBrokerageHarvest(
  taxableBrokerageBalance: number,
  taxableBrokerageBasis: number,
  requestedGain: number,
): BrokerageHarvestAllocation {
  const balance = nonnegative(taxableBrokerageBalance);
  const basis = Math.max(0, taxableBrokerageBasis);
  const requested = nonnegative(requestedGain);
  const embeddedGain = Math.max(0, balance - basis);
  const realizedGain = Math.min(requested, embeddedGain);

  if (realizedGain <= 0 || balance <= 0 || embeddedGain <= 0) {
    return {
      basisSold: 0,
      realizedGain: 0,
      basisAfterHarvest: roundToCents(basis),
      unharvestedGain: roundToCents(requested),
    };
  }

  const gainRatio = embeddedGain / balance;
  const proceeds = Math.min(balance, realizedGain / gainRatio);
  const basisSold = Math.max(0, proceeds - realizedGain);

  return {
    basisSold: roundToCents(basisSold),
    realizedGain: roundToCents(realizedGain),
    basisAfterHarvest: roundToCents(basis - basisSold + proceeds),
    unharvestedGain: roundToCents(requested - realizedGain),
  };
}

function applyExpectedReturns(
  balances: AccountBalances,
  expectedReturns: AccountReturns,
  warnings: string[],
  returnBases: AccountBalances = balances,
): { gainsOrLosses: AccountBalances; closingBalances: AccountBalances } {
  const gainsOrLosses: AccountBalances = {
    cash: roundToCents(returnBases.cash * (expectedReturns.cash ?? 0)),
    hsa: roundToCents(returnBases.hsa * (expectedReturns.hsa ?? 0)),
    taxableBrokerage: roundToCents(returnBases.taxableBrokerage * (expectedReturns.taxableBrokerage ?? 0)),
    traditional: roundToCents(returnBases.traditional * (expectedReturns.traditional ?? 0)),
    roth: roundToCents(returnBases.roth * (expectedReturns.roth ?? 0)),
  };
  const closingBalances: AccountBalances = {
    cash: closeAccountAfterReturn('cash', balances.cash, gainsOrLosses.cash, warnings),
    hsa: closeAccountAfterReturn('hsa', balances.hsa, gainsOrLosses.hsa, warnings),
    taxableBrokerage: closeAccountAfterReturn(
      'taxableBrokerage',
      balances.taxableBrokerage,
      gainsOrLosses.taxableBrokerage,
      warnings,
    ),
    traditional: closeAccountAfterReturn('traditional', balances.traditional, gainsOrLosses.traditional, warnings),
    roth: closeAccountAfterReturn('roth', balances.roth, gainsOrLosses.roth, warnings),
  };

  return { gainsOrLosses, closingBalances };
}

function closeAccountAfterReturn(account: keyof AccountBalances, balance: number, gainOrLoss: number, warnings: string[]): number {
  const closingBalance = balance + gainOrLoss;
  if (closingBalance < 0) {
    warnings.push(`${account} expected return would take the balance below zero; closing balance is floored at zero.`);
    return 0;
  }

  return roundToCents(closingBalance);
}

function withdrawFromAccount(balance: number, need: number): number {
  return Math.min(Math.max(0, balance), Math.max(0, need));
}

function computeSocialSecurityBenefit(
  claim: SocialSecurityClaimAssumptions | undefined,
  year: number,
): number {
  if (claim === undefined || year < claim.claimYear) {
    return 0;
  }

  return roundToCents(claim.annualBenefit * (1 + (claim.colaRate ?? 0)) ** (year - claim.claimYear));
}

function getHealthcarePhase(phases: readonly HealthcarePhase[], year: number): HealthcarePhase {
  return phases.find((phase) => phase.year === year) ?? { year, kind: 'none' };
}

function entriesForYear<TEntry extends AnnualAmount>(entries: readonly TEntry[], year: number): TEntry[] {
  return entries.filter((entry) => entry.year === year);
}

function positiveAnnualYears(entries: readonly AnnualAmount[]): number[] {
  return entries.filter((entry) => entry.amount > 0).map((entry) => entry.year);
}

function firstPositiveAnnualYear(entries: readonly AnnualAmount[]): number | undefined {
  return positiveAnnualYears(entries).sort((left, right) => left - right)[0];
}

function sumAnnualAmounts(entries: readonly AnnualAmount[], year: number): number {
  return entriesForYear(entries, year).reduce((sum, entry) => sum + entry.amount, 0);
}

function sumBalanceAmounts(balances: AccountBalances): number {
  return balances.cash + balances.hsa + balances.taxableBrokerage + balances.traditional + balances.roth;
}

function copyBalances(balances: AccountBalances): AccountBalances {
  return {
    cash: roundToCents(valueOrZero(balances.cash)),
    hsa: roundToCents(valueOrZero(balances.hsa)),
    taxableBrokerage: roundToCents(valueOrZero(balances.taxableBrokerage)),
    traditional: roundToCents(valueOrZero(balances.traditional)),
    roth: roundToCents(valueOrZero(balances.roth)),
  };
}

function valueOrZero(value: number | undefined): number {
  return value ?? 0;
}

function nonnegative(value: number | undefined): number {
  return Math.max(0, valueOrZero(value));
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

function formatDollars(value: number): string {
  return `$${roundToCents(value).toFixed(2)}`;
}
