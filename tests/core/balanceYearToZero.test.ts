import { describe, expect, it } from 'vitest';

import { balanceYearToZero } from '@/core/balanceYearToZero';
import { FLORIDA_STATE_TAX } from '@/core/constants/states/florida';
import { runProjection, type Scenario, type WithdrawalPlan } from '@/core/projection';

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    startYear: 2026,
    filingStatus: 'single',
    w2Income: [],
    consultingIncome: [],
    healthcare: [],
    pensionIncome: [],
    annuityIncome: [],
    rentalIncome: [],
    state: { incomeTaxLaw: FLORIDA_STATE_TAX },
    balances: {
      cash: 0,
      hsa: 0,
      taxableBrokerage: 0,
      traditional: 0,
      roth: 0,
    },
    basis: {
      taxableBrokerage: 0,
    },
    inflationRate: 0.03,
    expectedReturns: {},
    ...overrides,
  };
}

function makePlan(overrides: Partial<WithdrawalPlan> = {}): WithdrawalPlan {
  return {
    endYear: 2026,
    annualSpending: [],
    ...overrides,
  };
}

function snapshot(value: unknown): string {
  return JSON.stringify(value);
}

function expectWithinTolerance(value: number, tolerance: number): void {
  expect(Math.abs(value)).toBeLessThanOrEqual(tolerance);
}

function projectedYearOrThrow(scenario: Scenario, plan: WithdrawalPlan, year: number) {
  const projectedYear = runProjection(scenario, plan).find((candidateYear) => candidateYear.year === year);

  if (projectedYear === undefined) {
    throw new Error(`Expected projection row for ${year}`);
  }

  return projectedYear;
}

describe('balanceYearToZero', () => {
  it('converges within requested tolerance for a no-income $50k brokerage bridge year', () => {
    const tolerance = 1;
    const scenario = makeScenario({
      balances: {
        cash: 0,
        hsa: 0,
        taxableBrokerage: 500_000,
        traditional: 0,
        roth: 0,
      },
      basis: {
        taxableBrokerage: 500_000,
      },
    });
    const plan = makePlan({
      annualSpending: [{ year: 2026, amount: 50_000 }],
    });

    const result = balanceYearToZero(2026, scenario, plan, { tolerance });
    const projectedYear = projectedYearOrThrow(scenario, plan, 2026);

    expect(result).toMatchObject({
      year: 2026,
      converged: true,
    });
    expect(projectedYear.withdrawals.taxableBrokerage).toBeGreaterThanOrEqual(50_000);
    expectWithinTolerance(result.resultingCashflow, tolerance);
  });

  it('uses the default tolerance to find a near-zero after-tax cash flow', () => {
    const scenario = makeScenario({
      w2Income: [{ year: 2026, amount: 100_000 }],
      balances: {
        cash: 0,
        hsa: 0,
        taxableBrokerage: 500_000,
        traditional: 0,
        roth: 0,
      },
      basis: {
        taxableBrokerage: 500_000,
      },
    });
    const plan = makePlan({
      annualSpending: [{ year: 2026, amount: 60_000 }],
    });

    const result = balanceYearToZero(2026, scenario, plan);

    expect(result).toMatchObject({
      year: 2026,
      converged: true,
    });
    expectWithinTolerance(result.resultingCashflow, 10);
  });

  it('requires a larger total balancing brokerage draw when mortgage P&I is active', () => {
    const baseScenario = makeScenario({
      w2Income: [{ year: 2026, amount: 90_000 }],
      balances: {
        cash: 0,
        hsa: 0,
        taxableBrokerage: 500_000,
        traditional: 0,
        roth: 0,
      },
      basis: {
        taxableBrokerage: 500_000,
      },
    });
    const mortgageScenario = makeScenario({
      ...baseScenario,
      mortgage: {
        annualPI: 18_000,
        payoffYear: 2026,
      },
    });
    const plan = makePlan({
      annualSpending: [{ year: 2026, amount: 60_000 }],
    });

    const withoutMortgage = balanceYearToZero(2026, baseScenario, plan);
    const withMortgage = balanceYearToZero(2026, mortgageScenario, plan);
    const baselineWithoutMortgage = projectedYearOrThrow(baseScenario, plan, 2026);
    const baselineWithMortgage = projectedYearOrThrow(mortgageScenario, plan, 2026);

    expect(withoutMortgage.converged).toBe(true);
    expect(withMortgage.converged).toBe(true);
    expectWithinTolerance(withoutMortgage.resultingCashflow, 10);
    expectWithinTolerance(withMortgage.resultingCashflow, 10);
    expect(baselineWithMortgage.spending).toBe(baselineWithoutMortgage.spending + 18_000);
    expect(baselineWithMortgage.withdrawals.taxableBrokerage + withMortgage.brokerageWithdrawal).toBeGreaterThan(
      baselineWithoutMortgage.withdrawals.taxableBrokerage + withoutMortgage.brokerageWithdrawal,
    );
  });

  it('reports actual taxable brokerage withdrawal delta instead of the search candidate', () => {
    const scenario = makeScenario({
      w2Income: [{ year: 2026, amount: 100_000 }],
      balances: {
        cash: 0,
        hsa: 0,
        taxableBrokerage: 500_000,
        traditional: 0,
        roth: 0,
      },
      basis: {
        taxableBrokerage: 500_000,
      },
    });
    const plan = makePlan({
      annualSpending: [{ year: 2026, amount: 60_000 }],
    });
    const baseline = runProjection(scenario, plan)[0];
    const candidate = runProjection(scenario, {
      ...plan,
      annualSpending: [{ year: 2026, amount: 120_000 }],
    })[0];

    if (baseline === undefined || candidate === undefined) {
      throw new Error('Expected 2026 projection rows');
    }

    const result = balanceYearToZero(2026, scenario, plan, { maxIterations: 1 });

    expect(result.converged).toBe(true);
    expect(result.brokerageWithdrawal).toBe(
      candidate.withdrawals.taxableBrokerage - baseline.withdrawals.taxableBrokerage,
    );
    expect(result.brokerageWithdrawal).not.toBe(60_000);
  });

  it('returns zero additional brokerage withdrawal for an already-balanced year', () => {
    const scenario = makeScenario();
    const plan = makePlan();

    const result = balanceYearToZero(2026, scenario, plan, { tolerance: 0.01 });

    expect(result).toEqual({
      year: 2026,
      brokerageWithdrawal: 0,
      resultingCashflow: 0,
      iterations: 0,
      converged: true,
    });
  });

  it('returns the best attempted candidate when no bracket can converge', () => {
    const scenario = makeScenario({
      balances: {
        cash: 0,
        hsa: 0,
        taxableBrokerage: 10_000,
        traditional: 0,
        roth: 0,
      },
      basis: {
        taxableBrokerage: 10_000,
      },
    });
    const plan = makePlan({
      annualSpending: [{ year: 2026, amount: 50_000 }],
    });

    const result = balanceYearToZero(2026, scenario, plan);
    const baseline = projectedYearOrThrow(scenario, plan, 2026);
    const worseAttempt = projectedYearOrThrow(scenario, {
      ...plan,
      annualSpending: [{ year: 2026, amount: 60_000 }],
    }, 2026);

    expect(result).toMatchObject({
      year: 2026,
      brokerageWithdrawal: 0,
      resultingCashflow: -40_000,
      converged: false,
    });
    expect(result.resultingCashflow).toBe(baseline.afterTaxCashFlow);
    expect(Math.abs(result.resultingCashflow)).toBeLessThan(Math.abs(worseAttempt.afterTaxCashFlow));
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('converges when low brokerage basis creates significant LTCG drag', () => {
    const highBasisScenario = makeScenario({
      w2Income: [{ year: 2026, amount: 100_000 }],
      balances: {
        cash: 0,
        hsa: 0,
        taxableBrokerage: 500_000,
        traditional: 0,
        roth: 0,
      },
      basis: {
        taxableBrokerage: 500_000,
      },
    });
    const lowBasisScenario = makeScenario({
      ...highBasisScenario,
      basis: {
        taxableBrokerage: 10_000,
      },
    });
    const plan = makePlan({
      annualSpending: [{ year: 2026, amount: 60_000 }],
    });
    const tolerance = 5;

    const highBasis = balanceYearToZero(2026, highBasisScenario, plan, { tolerance, maxIterations: 1 });
    const lowBasis = balanceYearToZero(2026, lowBasisScenario, plan, { tolerance, maxIterations: 1 });

    expect(highBasis.converged).toBe(true);
    expect(lowBasis.converged).toBe(true);
    expectWithinTolerance(lowBasis.resultingCashflow, tolerance);
    expect(lowBasis.brokerageWithdrawal).toBeGreaterThan(highBasis.brokerageWithdrawal);
  });

  it('returns a defined result around an ACA cliff without oscillating', () => {
    const scenario = makeScenario({
      w2Income: [{ year: 2026, amount: 54_000 }],
      healthcare: [
        {
          year: 2026,
          kind: 'aca',
          householdSize: 1,
          annualBenchmarkPremium: 18_000,
          annualEnrollmentPremium: 18_000,
          advancePremiumTaxCredit: 14_000,
        },
      ],
      balances: {
        cash: 0,
        hsa: 0,
        taxableBrokerage: 500_000,
        traditional: 0,
        roth: 0,
      },
      basis: {
        taxableBrokerage: 50_000,
      },
    });
    const plan = makePlan({
      annualSpending: [{ year: 2026, amount: 45_000 }],
    });
    const tolerance = 5;
    const maxIterations = 30;

    const result = balanceYearToZero(2026, scenario, plan, { tolerance, maxIterations });

    expect(Number.isFinite(result.brokerageWithdrawal)).toBe(true);
    expect(Number.isFinite(result.resultingCashflow)).toBe(true);
    expect(result.iterations).toBeLessThanOrEqual(maxIterations);
    if (result.converged) {
      expectWithinTolerance(result.resultingCashflow, tolerance);
    } else {
      expect(Math.abs(result.resultingCashflow)).toBeGreaterThan(tolerance);
    }
  });

  it('can balance a zero-spending year when mortgage P&I creates the search range', () => {
    const scenario = makeScenario({
      w2Income: [{ year: 2026, amount: 80_000 }],
      mortgage: {
        annualPI: 50_000,
        payoffYear: 2026,
      },
      balances: {
        cash: 0,
        hsa: 0,
        taxableBrokerage: 500_000,
        traditional: 0,
        roth: 0,
      },
      basis: {
        taxableBrokerage: 500_000,
      },
    });
    const plan = makePlan();

    const result = balanceYearToZero(2026, scenario, plan);

    expect(result.converged).toBe(true);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.brokerageWithdrawal).toBeGreaterThanOrEqual(0);
    expectWithinTolerance(result.resultingCashflow, 10);
  });

  it('is idempotent and leaves the original scenario and plan unchanged', () => {
    const scenario = makeScenario({
      w2Income: [{ year: 2026, amount: 100_000 }],
      balances: {
        cash: 0,
        hsa: 0,
        taxableBrokerage: 500_000,
        traditional: 0,
        roth: 0,
      },
      basis: {
        taxableBrokerage: 500_000,
      },
    });
    const plan = makePlan({
      annualSpending: [{ year: 2026, amount: 60_000 }],
    });
    const scenarioBefore = snapshot(scenario);
    const planBefore = snapshot(plan);

    const first = balanceYearToZero(2026, scenario, plan);
    const second = balanceYearToZero(2026, scenario, plan);

    expect(second).toEqual(first);
    expect(snapshot(scenario)).toBe(scenarioBefore);
    expect(snapshot(plan)).toBe(planBefore);
  });
});
