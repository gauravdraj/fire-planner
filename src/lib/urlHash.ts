import type { Scenario, WithdrawalPlan } from '@/core/projection';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

const HASH_VERSION_PREFIX = 'v1:';

export type ScenarioHashPayload = Readonly<{
  scenario: Scenario;
  plan: WithdrawalPlan;
}>;

export function encodeScenario(payload: ScenarioHashPayload): string {
  const shareablePayload: ScenarioHashPayload = {
    scenario: payload.scenario,
    plan: payload.plan,
  };

  return `${HASH_VERSION_PREFIX}${compressToEncodedURIComponent(JSON.stringify(shareablePayload))}`;
}

export function decodeScenario(hash: string): ScenarioHashPayload | null {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;

  if (!normalizedHash.startsWith(HASH_VERSION_PREFIX)) {
    return null;
  }

  const compressedPayload = normalizedHash.slice(HASH_VERSION_PREFIX.length);

  if (compressedPayload.length === 0) {
    return null;
  }

  try {
    const json = decompressFromEncodedURIComponent(compressedPayload);

    if (typeof json !== 'string' || json.length === 0) {
      return null;
    }

    const parsed: unknown = JSON.parse(json);

    if (!isRecord(parsed) || !isRecord(parsed.scenario) || !isRecord(parsed.plan)) {
      return null;
    }

    return {
      scenario: parsed.scenario as Scenario,
      plan: parsed.plan as WithdrawalPlan,
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
