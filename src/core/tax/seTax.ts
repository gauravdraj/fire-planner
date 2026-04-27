import { CONSTANTS_2026 } from '../constants/2026';
import type { FilingStatus } from '../types';

export type SeTaxInput = {
  netSeIncome: number;
  w2WagesSubjectToSs: number;
  totalMedicareWages: number;
  filingStatus: FilingStatus;
};

export type SeTaxResult = {
  adjustedSeIncome: number;
  socialSecurityTaxableIncome: number;
  socialSecurityTax: number;
  medicareTax: number;
  additionalMedicareTax: number;
  totalSeTax: number;
  deductibleHalf: number;
};

// Tax outputs are nonnegative dollar amounts. This helper rounds positive values
// to cents with ROUND_HALF_UP-style behavior and is used only at return boundaries.
function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}

export function computeSeTax(input: SeTaxInput): SeTaxResult {
  const zeroResult = {
    adjustedSeIncome: 0,
    socialSecurityTaxableIncome: 0,
    socialSecurityTax: 0,
    medicareTax: 0,
    additionalMedicareTax: 0,
    totalSeTax: 0,
    deductibleHalf: 0,
  };

  if (input.netSeIncome <= 0) {
    return zeroResult;
  }

  const seTax = CONSTANTS_2026.seTax;
  const adjustedSeIncome = input.netSeIncome * seTax.netEarningsMultiplier;
  const w2WagesSubjectToSs = Math.max(0, input.w2WagesSubjectToSs);
  const totalMedicareWages = Math.max(0, input.totalMedicareWages);
  const remainingSocialSecurityWageBase = Math.max(0, seTax.ssWageBase - w2WagesSubjectToSs);
  const socialSecurityTaxableIncome = Math.min(adjustedSeIncome, remainingSocialSecurityWageBase);
  const socialSecurityTax = socialSecurityTaxableIncome * seTax.oasdiRate;
  const medicareTax = adjustedSeIncome * seTax.medicareRate;
  const additionalMedicareThreshold = seTax.additionalMedicareThresholds[input.filingStatus];
  const additionalMedicareTaxableIncome = Math.min(
    adjustedSeIncome,
    Math.max(0, totalMedicareWages + adjustedSeIncome - additionalMedicareThreshold),
  );
  const additionalMedicareTax = additionalMedicareTaxableIncome * seTax.additionalMedicareRate;

  return {
    adjustedSeIncome: roundToCents(adjustedSeIncome),
    socialSecurityTaxableIncome: roundToCents(socialSecurityTaxableIncome),
    socialSecurityTax: roundToCents(socialSecurityTax),
    medicareTax: roundToCents(medicareTax),
    additionalMedicareTax: roundToCents(additionalMedicareTax),
    totalSeTax: roundToCents(socialSecurityTax + medicareTax + additionalMedicareTax),
    deductibleHalf: roundToCents((socialSecurityTax + medicareTax) * seTax.deductiblePortionRate),
  };
}
