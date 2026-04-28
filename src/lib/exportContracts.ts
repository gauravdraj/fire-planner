import { CONSTANTS_2026 } from '@/core/constants/2026';
import type { WithdrawalPlan } from '@/core/projection';

import packageJson from '../../package.json';
import { decodeScenario, encodeScenario, type ScenarioHashInput, type ScenarioHashPayload } from './urlHash';

export const APP_VERSION = packageJson.version;

export const methodologySourceContract = {
  constantsRetrievedAt: CONSTANTS_2026.retrievedAt,
  hasPerConstantSourceUrls: false,
  sourceUrlLocation: 'methodology-content',
} as const;

export type ExportMetadata = Readonly<{
  appVersion: string;
  constantsRetrievedAt: string;
  generatedAt: string;
  canonicalScenarioFormat: 'urlHash:v1';
}>;

export type ScenarioJsonExportEnvelope = Readonly<{
  metadata: ExportMetadata;
  canonicalScenarioHash: string;
  payload: ScenarioHashPayload;
}>;

export function buildExportMetadata(generatedAt: Date | string = new Date()): ExportMetadata {
  return {
    appVersion: APP_VERSION,
    constantsRetrievedAt: CONSTANTS_2026.retrievedAt,
    generatedAt: typeof generatedAt === 'string' ? generatedAt : generatedAt.toISOString(),
    canonicalScenarioFormat: 'urlHash:v1',
  };
}

export function buildScenarioJsonExportEnvelope(
  input: ScenarioHashInput,
  generatedAt: Date | string = new Date(),
): ScenarioJsonExportEnvelope {
  const canonicalScenarioHash = encodeScenario(input);
  const payload = decodeScenario(canonicalScenarioHash);

  if (payload === null) {
    throw new Error('Encoded scenario payload could not be decoded.');
  }

  return {
    metadata: buildExportMetadata(generatedAt),
    canonicalScenarioHash,
    payload,
  };
}

export const withdrawalPlanManualFields = [
  'annualSpending',
  'rothConversions',
  'brokerageHarvests',
] as const satisfies readonly (keyof WithdrawalPlan)[];

export const balanceSweepContract = {
  supported: false,
  inspectedFields: withdrawalPlanManualFields,
  reason:
    'WithdrawalPlan has no field for manual brokerage-withdrawal targets. annualSpending is a spending override, not a negative brokerage-withdrawal field, so Balance all years must remain deferred unless the engine contract changes.',
} as const;
