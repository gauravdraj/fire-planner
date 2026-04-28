import type { CustomLaw } from '@/core/constants/customLaw';
import type { Scenario, WithdrawalPlan } from '@/core/projection';
import type { BasicFormValues } from '@/lib/basicFormMapping';
import {
  buildScenarioJsonExportEnvelope,
  type ExportMetadata,
  type ScenarioJsonExportEnvelope,
} from '@/lib/exportContracts';
import type { ScenarioHashInput, ScenarioHashPayload } from '@/lib/urlHash';

export type ScenarioJsonExport = Readonly<
  ScenarioJsonExportEnvelope & {
    formValues: BasicFormValues;
    projectionInputs: ScenarioHashInput;
    scenario: Scenario;
    withdrawalPlan: WithdrawalPlan;
    customLaw?: CustomLaw;
  }
>;

export function buildScenarioJsonExport(
  formValues: BasicFormValues,
  scenario: Scenario,
  plan: WithdrawalPlan,
  customLaw?: CustomLaw,
  customLawActive = customLaw !== undefined,
  generatedAt: Date | string = new Date(),
): string {
  const exportCustomLaw = customLaw ?? scenario.customLaw;
  const projectionInputs = buildProjectionInputs(scenario, plan, exportCustomLaw, customLawActive);
  const envelope = buildScenarioJsonExportEnvelope(projectionInputs, generatedAt);
  const jsonExport = buildScenarioJsonExportObject({
    customLaw: exportCustomLaw,
    envelope,
    formValues,
    plan,
    projectionInputs,
    scenario,
  });

  return JSON.stringify(jsonExport, null, 2);
}

function buildProjectionInputs(
  scenario: Scenario,
  plan: WithdrawalPlan,
  customLaw: CustomLaw | undefined,
  customLawActive: boolean,
): ScenarioHashInput {
  const projectionInputs = {
    scenario,
    plan,
    customLawActive,
  };

  return customLaw === undefined ? projectionInputs : { ...projectionInputs, customLaw };
}

function buildScenarioJsonExportObject({
  customLaw,
  envelope,
  formValues,
  plan,
  projectionInputs,
  scenario,
}: {
  customLaw: CustomLaw | undefined;
  envelope: Readonly<{
    metadata: ExportMetadata;
    canonicalScenarioHash: string;
    payload: ScenarioHashPayload;
  }>;
  formValues: BasicFormValues;
  plan: WithdrawalPlan;
  projectionInputs: ScenarioHashInput;
  scenario: Scenario;
}): ScenarioJsonExport {
  const exportObject = {
    ...envelope,
    formValues,
    projectionInputs,
    scenario,
    withdrawalPlan: plan,
  };

  return customLaw === undefined ? exportObject : { ...exportObject, customLaw };
}
