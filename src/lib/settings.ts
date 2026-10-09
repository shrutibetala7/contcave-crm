import { settingsCol } from "@/lib/db/collections";
import { DEFAULT_WORKFLOW_SETTINGS, type WorkflowSettings } from "@/lib/validation/settings";

/** The tenant's workflow settings, falling back to the defaults for anything unset. */
export async function getWorkflowSettings(tenantId: string): Promise<WorkflowSettings> {
  const doc = await (await settingsCol()).findOne({ _id: tenantId });
  return { ...DEFAULT_WORKFLOW_SETTINGS, ...(doc?.workflow ?? {}) };
}

export async function saveWorkflowSettings(tenantId: string, workflow: WorkflowSettings, userId: string): Promise<void> {
  await (await settingsCol()).updateOne(
    { _id: tenantId },
    { $set: { workflow, updatedAt: new Date(), updatedBy: userId } },
    { upsert: true }
  );
}
