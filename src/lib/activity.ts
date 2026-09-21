import { ObjectId } from "mongodb";
import { activitiesCol } from "@/lib/db/collections";
import type { ActivityDirection, ActivityEntityType, ActivityType } from "@/lib/enums";

export interface WriteActivityInput {
  tenantId: string;
  entityType: ActivityEntityType;
  entityId: string;
  type: ActivityType;
  direction?: ActivityDirection | null;
  body?: string | null;
  occurredAt?: Date;
  createdBy: string;
  meta?: Record<string, unknown> | null;
}

/** Every note/call/status-change writes here — the shared audit timeline (spec §3.8). */
export async function writeActivity(input: WriteActivityInput): Promise<void> {
  const activities = await activitiesCol();
  const now = new Date();
  await activities.insertOne({
    _id: new ObjectId(),
    tenantId: input.tenantId,
    entityType: input.entityType,
    entityId: input.entityId,
    type: input.type,
    direction: input.direction ?? null,
    body: input.body ?? null,
    occurredAt: input.occurredAt ?? now,
    createdBy: input.createdBy,
    meta: input.meta ?? null,
    createdAt: now,
  });
}

/** Status changes write an activity automatically (spec §3.8). */
export async function writeStatusChangeActivity(params: {
  tenantId: string;
  entityType: "enquiry" | "studio";
  entityId: string;
  from: string;
  to: string;
  note?: string | null;
  createdBy: string;
}): Promise<void> {
  await writeActivity({
    tenantId: params.tenantId,
    entityType: params.entityType,
    entityId: params.entityId,
    type: "status_change",
    body: params.note ?? null,
    createdBy: params.createdBy,
    meta: { from: params.from, to: params.to },
  });
}
