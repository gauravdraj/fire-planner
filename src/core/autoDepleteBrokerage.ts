export function computeAutoDepleteSchedule(
  openingBalance: number,
  yearsToDeplete: number,
  scaleUpFactor: number,
  expectedReturn: number,
): number[] {
  const years = Number.isFinite(yearsToDeplete) ? Math.max(0, Math.trunc(yearsToDeplete)) : 0;
  const balance = Number.isFinite(openingBalance) ? Math.max(0, openingBalance) : 0;

  if (years === 0) {
    return [];
  }

  if (balance === 0) {
    return Array.from({ length: years }, () => 0);
  }

  const growth = Number.isFinite(scaleUpFactor) ? scaleUpFactor : 0;
  const returnRate = Number.isFinite(expectedReturn) ? expectedReturn : 0;
  const firstWithdrawal = computeFirstWithdrawal(balance, years, growth, returnRate);

  return Array.from({ length: years }, (_ignored, index) => Math.max(0, firstWithdrawal * (1 + growth) ** index));
}

function computeFirstWithdrawal(balance: number, years: number, growth: number, returnRate: number): number {
  if (Math.abs(returnRate - growth) < 1e-10) {
    return balance / years;
  }

  const discountBase = 1 + returnRate;
  if (Math.abs(discountBase) < 1e-10) {
    return balance / years;
  }

  const growthDiscountRatio = (1 + growth) / discountBase;
  const denominator = discountBase * (1 - growthDiscountRatio ** years);
  const numerator = balance * (returnRate - growth);

  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-10) {
    return balance / years;
  }

  const firstWithdrawal = numerator / denominator;

  return Number.isFinite(firstWithdrawal) && firstWithdrawal > 0 ? firstWithdrawal : balance / years;
}
