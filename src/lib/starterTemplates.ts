import type { BasicFormValues } from '@/lib/basicFormMapping';

export type StarterTemplate = Readonly<{
  id: 'brokerage-bridge-72t' | 'roth-ladder';
  label: string;
  shortDescription: string;
  longDescription: string;
  formValues: BasicFormValues;
}>;

export const STARTER_TEMPLATES = [
  {
    id: 'brokerage-bridge-72t',
    label: 'Brokerage bridge with 72(t) context',
    shortDescription: 'A 10-year taxable brokerage bridge for an early-retired MFJ household.',
    longDescription:
      'Models the spreadsheet-style 72(t) example as a 10-year auto-deplete taxable brokerage bridge with ACA years before later Social Security income. Phase 1B does not introduce a separate 72(t) SEPP withdrawal stream into projection; the template uses the existing basic-form fields to show the bridge-year cash-flow tradeoff.',
    formValues: {
      currentYear: 2026,
      filingStatus: 'mfj',
      stateCode: 'FL',
      primaryAge: 55,
      partnerAge: 55,
      retirementYear: 2026,
      planEndAge: 95,
      annualSpendingToday: 90_000,
      annualMortgagePAndI: 0,
      mortgagePayoffYear: 0,
      annualW2Income: 0,
      annualConsultingIncome: 0,
      annualRentalIncome: 0,
      annualSocialSecurityBenefit: 52_000,
      socialSecurityClaimAge: 67,
      annualPensionOrAnnuityIncome: 0,
      brokerageAndCashBalance: 675_000,
      taxableBrokerageBasis: 520_000,
      hsaBalance: 25_000,
      traditionalBalance: 1_650_000,
      rothBalance: 360_000,
      autoDepleteBrokerageEnabled: true,
      autoDepleteBrokerageYears: 10,
      autoDepleteBrokerageAnnualScaleUpFactor: 0.02,
      expectedReturnTraditional: 0.05,
      expectedReturnRoth: 0.05,
      expectedReturnBrokerage: 0.04,
      expectedReturnHsa: 0.04,
      brokerageDividendYield: 0.015,
      brokerageQdiPercentage: 0.95,
      healthcarePhase: 'aca',
    },
  },
  {
    id: 'roth-ladder',
    label: 'Roth ladder bridge',
    shortDescription: 'A 5-year taxable brokerage bridge around a Roth conversion ladder strategy.',
    longDescription:
      'Frames the Roth ladder example as five early bridge years funded from taxable brokerage while traditional IRA assets remain available for conversion planning. It highlights the tradeoff between preserving ACA-friendly income and leaving enough brokerage liquidity before later Social Security income begins.',
    formValues: {
      currentYear: 2026,
      filingStatus: 'mfj',
      stateCode: 'PA',
      primaryAge: 50,
      partnerAge: 49,
      retirementYear: 2026,
      planEndAge: 95,
      annualSpendingToday: 82_000,
      annualMortgagePAndI: 18_000,
      mortgagePayoffYear: 2030,
      annualW2Income: 0,
      annualConsultingIncome: 0,
      annualRentalIncome: 0,
      annualSocialSecurityBenefit: 58_000,
      socialSecurityClaimAge: 70,
      annualPensionOrAnnuityIncome: 0,
      brokerageAndCashBalance: 625_000,
      taxableBrokerageBasis: 500_000,
      hsaBalance: 35_000,
      traditionalBalance: 1_550_000,
      rothBalance: 520_000,
      autoDepleteBrokerageEnabled: true,
      autoDepleteBrokerageYears: 5,
      autoDepleteBrokerageAnnualScaleUpFactor: 0.03,
      expectedReturnTraditional: 0.05,
      expectedReturnRoth: 0.05,
      expectedReturnBrokerage: 0.04,
      expectedReturnHsa: 0.04,
      brokerageDividendYield: 0.0125,
      brokerageQdiPercentage: 0.95,
      healthcarePhase: 'aca',
    },
  },
] as const satisfies readonly StarterTemplate[];
