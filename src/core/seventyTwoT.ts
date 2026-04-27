export function compute72tIraSize(rate: number, lifeExpectancyYears: number, annualIncome: number): number {
  const requiredIraSize =
    rate === 0
      ? annualIncome * lifeExpectancyYears
      : (annualIncome * (1 - Math.pow(1 + rate, -lifeExpectancyYears))) / rate;

  return roundToCents(requiredIraSize);
}

function roundToCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Math.trunc(Math.abs(value) * 100 + 0.5 + Number.EPSILON);

  return (sign * cents) / 100;
}
