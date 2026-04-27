export function toReal(amount: number, year: number, baseYear: number, inflationRate: number): number {
  return amount / (1 + inflationRate) ** (year - baseYear);
}
