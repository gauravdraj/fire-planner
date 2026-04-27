import type { BracketedStateTaxLaw, StateBracketTable, StateTaxBracket } from '../../tax/state';

const RETRIEVED_AT = '2026-04-26';
const CA_FTB_2025_TAX_RATE_SCHEDULES =
  'California Franchise Tax Board, 2025 Form 540 Personal Income Tax Booklet, Tax Rate Schedules, https://www.ftb.ca.gov/forms/2025/2025-540-booklet.html#Tax-Rate-Schedules';

function freezeBrackets<T extends readonly StateTaxBracket[]>(brackets: T): T {
  for (const bracket of brackets) {
    Object.freeze(bracket);
  }

  return Object.freeze(brackets) as T;
}

const SCHEDULE_X_SINGLE_OR_MFS = freezeBrackets([
  { from: 0, upTo: 11_079, baseTax: 0, rate: 0.01 },
  { from: 11_079, upTo: 26_264, baseTax: 110.79, rate: 0.02 },
  { from: 26_264, upTo: 41_452, baseTax: 414.49, rate: 0.04 },
  { from: 41_452, upTo: 57_542, baseTax: 1_022.01, rate: 0.06 },
  { from: 57_542, upTo: 72_724, baseTax: 1_987.41, rate: 0.08 },
  { from: 72_724, upTo: 371_479, baseTax: 3_201.97, rate: 0.093 },
  { from: 371_479, upTo: 445_771, baseTax: 30_986.19, rate: 0.103 },
  { from: 445_771, upTo: 742_953, baseTax: 38_638.27, rate: 0.113 },
  { from: 742_953, baseTax: 72_219.84, rate: 0.123 },
] as const);

const SCHEDULE_Y_MFJ = freezeBrackets([
  { from: 0, upTo: 22_158, baseTax: 0, rate: 0.01 },
  { from: 22_158, upTo: 52_528, baseTax: 221.58, rate: 0.02 },
  { from: 52_528, upTo: 82_904, baseTax: 828.98, rate: 0.04 },
  { from: 82_904, upTo: 115_084, baseTax: 2_044.02, rate: 0.06 },
  { from: 115_084, upTo: 145_448, baseTax: 3_974.82, rate: 0.08 },
  { from: 145_448, upTo: 742_958, baseTax: 6_403.94, rate: 0.093 },
  { from: 742_958, upTo: 891_542, baseTax: 61_972.37, rate: 0.103 },
  { from: 891_542, upTo: 1_485_906, baseTax: 77_276.52, rate: 0.113 },
  { from: 1_485_906, baseTax: 144_439.65, rate: 0.123 },
] as const);

const SCHEDULE_Z_HOH = freezeBrackets([
  { from: 0, upTo: 22_173, baseTax: 0, rate: 0.01 },
  { from: 22_173, upTo: 52_530, baseTax: 221.73, rate: 0.02 },
  { from: 52_530, upTo: 67_716, baseTax: 828.87, rate: 0.04 },
  { from: 67_716, upTo: 83_805, baseTax: 1_436.31, rate: 0.06 },
  { from: 83_805, upTo: 98_990, baseTax: 2_401.65, rate: 0.08 },
  { from: 98_990, upTo: 505_208, baseTax: 3_616.45, rate: 0.093 },
  { from: 505_208, upTo: 606_251, baseTax: 41_394.72, rate: 0.103 },
  { from: 606_251, upTo: 1_010_417, baseTax: 51_802.15, rate: 0.113 },
  { from: 1_010_417, baseTax: 97_472.91, rate: 0.123 },
] as const);

const CALIFORNIA_BRACKETS = Object.freeze({
  single: SCHEDULE_X_SINGLE_OR_MFS,
  mfj: SCHEDULE_Y_MFJ,
  hoh: SCHEDULE_Z_HOH,
  mfs: SCHEDULE_X_SINGLE_OR_MFS,
} satisfies StateBracketTable);

export const CALIFORNIA_STATE_TAX = Object.freeze({
  stateCode: 'CA',
  stateName: 'California',
  taxYear: 2025,
  source: CA_FTB_2025_TAX_RATE_SCHEDULES,
  retrievedAt: RETRIEVED_AT,
  kind: 'bracketed',
  brackets: CALIFORNIA_BRACKETS,
} satisfies BracketedStateTaxLaw);
