import type { FilingStatus } from '../types';

export type TaxableSocialSecurityInput = {
  grossSocialSecurityBenefits: number;
  otherIncomeBeforeSocialSecurity: number;
  taxExemptInterest: number;
  filingStatus: FilingStatus;
  isMfsLivingTogether?: boolean;
};

export type TaxableSocialSecurityResult = {
  taxableAmount: number;
  provisionalIncome: number;
  thresholds: {
    tier1: number;
    tier2: number;
  };
};

type SocialSecurityThresholds = TaxableSocialSecurityResult['thresholds'];

// IRS Publication 915 (2025), "Base amount": $25,000 for single, head of
// household, and MFS living apart all year; $32,000 for MFJ; $0 for MFS living
// with spouse at any time. https://www.irs.gov/publications/p915
const TIER_1_THRESHOLDS = {
  single: 25_000,
  mfj: 32_000,
  mfsLivingTogether: 0,
} as const;

// IRS Publication 915 (2025), "Maximum taxable part": 85% tier starts when
// provisional income exceeds $34,000, or $44,000 for MFJ; MFS living together
// is subject to the 85% worksheet path from zero. https://www.irs.gov/publications/p915
const TIER_2_THRESHOLDS = {
  single: 34_000,
  mfj: 44_000,
  mfsLivingTogether: 0,
} as const;

// Tax outputs are nonnegative dollar amounts. This helper rounds positive values
// to cents with ROUND_HALF_UP-style behavior and is used only at return boundaries.
function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + 1e-9);

  return (sign * cents) / 100;
}

export function computeTaxableSocialSecurity(input: TaxableSocialSecurityInput): TaxableSocialSecurityResult {
  const grossBenefits = Math.max(0, input.grossSocialSecurityBenefits);
  const halfBenefits = grossBenefits * 0.5;
  const provisionalIncome = input.otherIncomeBeforeSocialSecurity + input.taxExemptInterest + halfBenefits;
  const thresholds = getThresholds(input.filingStatus, input.isMfsLivingTogether === true);
  const taxableAmount = computeTaxableAmount(grossBenefits, provisionalIncome, thresholds);

  return {
    taxableAmount: roundToCents(taxableAmount),
    provisionalIncome: roundToCents(provisionalIncome),
    thresholds,
  };
}

function getThresholds(filingStatus: FilingStatus, isMfsLivingTogether: boolean): SocialSecurityThresholds {
  if (filingStatus === 'mfj') {
    return {
      tier1: TIER_1_THRESHOLDS.mfj,
      tier2: TIER_2_THRESHOLDS.mfj,
    };
  }

  if (filingStatus === 'mfs' && isMfsLivingTogether) {
    return {
      tier1: TIER_1_THRESHOLDS.mfsLivingTogether,
      tier2: TIER_2_THRESHOLDS.mfsLivingTogether,
    };
  }

  return {
    tier1: TIER_1_THRESHOLDS.single,
    tier2: TIER_2_THRESHOLDS.single,
  };
}

function computeTaxableAmount(
  grossBenefits: number,
  provisionalIncome: number,
  thresholds: SocialSecurityThresholds,
): number {
  if (grossBenefits <= 0 || provisionalIncome <= thresholds.tier1) {
    return 0;
  }

  const maxTaxableBenefits = grossBenefits * 0.85;

  if (provisionalIncome <= thresholds.tier2) {
    return Math.min(halfOf(grossBenefits), (provisionalIncome - thresholds.tier1) * 0.5, maxTaxableBenefits);
  }

  const tierZoneAmount = Math.max(0, thresholds.tier2 - thresholds.tier1);
  const tierZoneTaxableAmount = Math.min(halfOf(grossBenefits), tierZoneAmount * 0.5);
  const upperTierTaxableAmount = (provisionalIncome - thresholds.tier2) * 0.85 + tierZoneTaxableAmount;

  return Math.min(upperTierTaxableAmount, maxTaxableBenefits);
}

function halfOf(value: number): number {
  return value * 0.5;
}
