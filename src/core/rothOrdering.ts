export type RothConversionLayer = Readonly<{
  yearConverted: number;
  taxableAmount: number;
  nontaxableAmount?: number;
}>;

export type RothBasisState = Readonly<{
  regularContributionBasis: number;
  conversionLayers: readonly RothConversionLayer[];
  legacyBasisAssumption?: boolean;
}>;

export type RothDistributionAllocation = Readonly<{
  regularContributionBasisUsed: number;
  conversionTaxableUsed: number;
  conversionNontaxableUsed: number;
  earningsUsed: number;
  recaptureAdditionalTax: number;
  remainingState: RothBasisState;
  earningsTapped: boolean;
}>;

export type RothDistributionInput = Readonly<{
  amount: number;
  state: RothBasisState;
  taxYear: number;
  ownerAge: number | null;
}>;

const ROTH_RECAPTURE_TAX_RATE = 0.1;

export function allocateRothDistribution(input: RothDistributionInput): RothDistributionAllocation {
  let remainingDistribution = roundToCents(nonnegative(input.amount));
  const regularContributionBasisUsed = Math.min(
    roundToCents(nonnegative(input.state.regularContributionBasis)),
    remainingDistribution,
  );
  remainingDistribution = roundToCents(remainingDistribution - regularContributionBasisUsed);

  let conversionTaxableUsed = 0;
  let conversionNontaxableUsed = 0;
  let recaptureAdditionalTax = 0;
  const remainingLayers: RothConversionLayer[] = [];

  for (const layer of [...input.state.conversionLayers].sort((left, right) => left.yearConverted - right.yearConverted)) {
    let taxableRemaining = roundToCents(nonnegative(layer.taxableAmount));
    let nontaxableRemaining = roundToCents(nonnegative(layer.nontaxableAmount ?? 0));

    const taxableUsed = Math.min(taxableRemaining, remainingDistribution);
    if (taxableUsed > 0) {
      conversionTaxableUsed = roundToCents(conversionTaxableUsed + taxableUsed);
      taxableRemaining = roundToCents(taxableRemaining - taxableUsed);
      remainingDistribution = roundToCents(remainingDistribution - taxableUsed);

      if (isConversionRecaptureTaxable(input.taxYear, layer.yearConverted, input.ownerAge)) {
        recaptureAdditionalTax = roundToCents(recaptureAdditionalTax + taxableUsed * ROTH_RECAPTURE_TAX_RATE);
      }
    }

    const nontaxableUsed = Math.min(nontaxableRemaining, remainingDistribution);
    if (nontaxableUsed > 0) {
      conversionNontaxableUsed = roundToCents(conversionNontaxableUsed + nontaxableUsed);
      nontaxableRemaining = roundToCents(nontaxableRemaining - nontaxableUsed);
      remainingDistribution = roundToCents(remainingDistribution - nontaxableUsed);
    }

    if (taxableRemaining > 0 || nontaxableRemaining > 0) {
      remainingLayers.push({
        yearConverted: layer.yearConverted,
        taxableAmount: taxableRemaining,
        ...(nontaxableRemaining > 0 ? { nontaxableAmount: nontaxableRemaining } : {}),
      });
    }
  }

  const earningsUsed = roundToCents(remainingDistribution);

  return {
    regularContributionBasisUsed,
    conversionTaxableUsed,
    conversionNontaxableUsed,
    earningsUsed,
    recaptureAdditionalTax,
    remainingState: {
      regularContributionBasis: roundToCents(nonnegative(input.state.regularContributionBasis) - regularContributionBasisUsed),
      conversionLayers: remainingLayers,
      ...(input.state.legacyBasisAssumption === true ? { legacyBasisAssumption: true } : {}),
    },
    earningsTapped: earningsUsed > 0,
  };
}

export function addRothConversionLayer(state: RothBasisState, layer: RothConversionLayer): RothBasisState {
  const taxableAmount = roundToCents(nonnegative(layer.taxableAmount));
  const nontaxableAmount = roundToCents(nonnegative(layer.nontaxableAmount ?? 0));

  if (taxableAmount <= 0 && nontaxableAmount <= 0) {
    return state;
  }

  return {
    ...state,
    conversionLayers: [
      ...state.conversionLayers,
      {
        yearConverted: Math.trunc(layer.yearConverted),
        taxableAmount,
        ...(nontaxableAmount > 0 ? { nontaxableAmount } : {}),
      },
    ],
  };
}

export function addRegularRothBasis(state: RothBasisState, amount: number): RothBasisState {
  return {
    ...state,
    regularContributionBasis: roundToCents(nonnegative(state.regularContributionBasis) + nonnegative(amount)),
  };
}

export function isConversionRecaptureTaxable(taxYear: number, conversionYear: number, ownerAge: number | null): boolean {
  if (ownerAge !== null && ownerAge >= 60) {
    return false;
  }

  return taxYear >= conversionYear && taxYear <= conversionYear + 4;
}

function nonnegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
