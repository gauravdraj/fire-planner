/*
 * Simplified Gate 2 Schedule E rental flow. User-supplied net rental income
 * flows into AGI exactly as entered, while cash flow stays display-only for
 * projection reporting. NIIT classification is represented only by whether the
 * taxpayer materially participates in the rental activity.
 *
 * Explicit non-goals: depreciation calculation, passive-loss limits, grouping
 * elections, and Section 199A rental real-estate qualification.
 *
 * Sources:
 * - IRC Section 469 (26 U.S.C. 469), passive activity losses and credits
 *   limited for activities without material participation, retrieved 2026-04-26,
 *   https://uscode.house.gov/view.xhtml?req=(title:26%20section:469%20edition:prelim)
 * - IRS Publication 925 (2025), Passive Activity and At-Risk Rules, material
 *   participation and passive rental activity rules, retrieved 2026-04-26,
 *   https://www.irs.gov/publications/p925
 * - IRS Instructions for Schedule E (Form 1040) (2025), rental real estate
 *   income and expense reporting, retrieved 2026-04-26,
 *   https://www.irs.gov/instructions/i1040se
 */

export type RentalEInput = Readonly<{
  netRentalIncome: number;
  cashFlow?: number;
}>;

export function flowToAgi(input: RentalEInput): number {
  return input.netRentalIncome;
}

export function isRentalNiitEligible(_input: RentalEInput, materiallyParticipates = false): boolean {
  return !materiallyParticipates;
}
