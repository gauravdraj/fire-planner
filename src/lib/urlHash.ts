import { isCustomLawActive, type CustomLaw } from '@/core/constants/customLaw';
import type { Scenario, WithdrawalPlan } from '@/core/projection';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

const HASH_VERSION_PREFIX = 'v1:';

export type ScenarioHashPayload = Readonly<{
  scenario: Scenario;
  plan: WithdrawalPlan;
  customLaw?: CustomLaw;
  customLawActive: boolean;
}>;

type ScenarioHashInput = Readonly<{
  scenario: Scenario;
  plan: WithdrawalPlan;
  customLaw?: CustomLaw;
  customLawActive?: boolean;
}>;

export function encodeScenario(payload: ScenarioHashInput): string {
  const customLaw = payload.customLaw ?? payload.scenario.customLaw;
  const customLawActive = payload.customLawActive === true && isCustomLawActive(customLaw);
  const scenario = scenarioWithCustomLawState(payload.scenario, customLaw, customLawActive);
  const shareablePayload =
    customLaw === undefined
      ? {
          scenario,
          plan: payload.plan,
          customLawActive,
        }
      : {
          scenario,
          plan: payload.plan,
          customLaw,
          customLawActive,
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

    const customLaw = customLawFromPayload(parsed, parsed.scenario);
    const customLawActive = parsed.customLawActive === true && isCustomLawActive(customLaw);
    const payload = {
      scenario: scenarioWithCustomLawState(parsed.scenario as Scenario, customLaw, customLawActive),
      plan: parsed.plan as WithdrawalPlan,
      customLawActive,
    };

    return customLaw === undefined ? payload : { ...payload, customLaw };
  } catch {
    return null;
  }
}

function customLawFromPayload(payload: Record<string, unknown>, scenario: Record<string, unknown>): CustomLaw | undefined {
  if (isRecord(payload.customLaw)) {
    return payload.customLaw as CustomLaw;
  }

  if (isRecord(scenario.customLaw)) {
    return scenario.customLaw as CustomLaw;
  }

  return undefined;
}

function scenarioWithCustomLawState(
  scenario: Scenario,
  customLaw: CustomLaw | undefined,
  customLawActive: boolean,
): Scenario {
  const { customLaw: _ignoredCustomLaw, ...scenarioWithoutCustomLaw } = scenario;

  if (!customLawActive || customLaw === undefined) {
    return scenarioWithoutCustomLaw;
  }

  return {
    ...scenarioWithoutCustomLaw,
    customLaw,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
