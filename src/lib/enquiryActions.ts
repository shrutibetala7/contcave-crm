import { ObjectId } from "mongodb";
import { activitiesCol, contactsCol, enquiriesCol, type EnquiryMongo } from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/objectId";
import { recomputeBrandRollups } from "@/lib/brandRollup";
import { NotFoundError } from "@/lib/api/errors";
import { TransitionError } from "@/lib/stateMachine/errors";
import { isOpenStatus } from "@/lib/enums";
import { isUnreachable } from "@/lib/leadHygiene";
import type { Plan, WorkflowEnquiry } from "@/lib/workflow";

/** How long after a save Undo still works (the toast shows for 5s; this allows for a slow network). */
export const UNDO_WINDOW_MS = 30_000;

/** Load an enquiry in the shape the planner needs. */
export async function loadForWorkflow(tenantId: string, id: string): Promise<{ doc: EnquiryMongo; wf: WorkflowEnquiry }> {
  const doc = await (await enquiriesCol()).findOne({ _id: toObjectId(id), tenantId });
  if (!doc) throw new NotFoundError("Enquiry");
  const contact = doc.contactId
    ? await (await contactsCol()).findOne({ _id: toObjectId(doc.contactId), tenantId }, { projection: { phone: 1, instagramHandle: 1 } })
    : null;
  return { doc, wf: { ...doc, reachable: !isUnreachable(contact) } };
}

function valueAt(doc: unknown, path: string): unknown {
  let cur: unknown = doc;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur ?? null;
}

/**
 * Apply a plan from lib/workflow.ts: one conditional write (so two people
 * acting at once can't both win), one activity row carrying what the write
 * replaced (for Undo), then the side effects of the stage it lands in.
 */
export async function applyPlan(params: {
  tenantId: string;
  doc: EnquiryMongo;
  plan: Plan;
  userId: string;
  now?: Date;
  /** System actions (the shoot-date job) aren't undoable. */
  undoable?: boolean;
}): Promise<{ enquiry: EnquiryMongo; activityId: string }> {
  const { tenantId, doc, plan, userId } = params;
  const now = params.now ?? new Date();

  // Rule 2, enforced at the last possible moment: open means a follow-up.
  const status = (plan.set.status as EnquiryMongo["status"] | undefined) ?? doc.status;
  const followUp = "followUp" in plan.set ? plan.set.followUp : doc.followUp;
  if (isOpenStatus(status) && !followUp) {
    throw new TransitionError("An open enquiry needs a next follow-up.");
  }

  const activityId = new ObjectId();
  const before: Record<string, unknown> = {};
  for (const key of Object.keys(plan.set)) before[key] = valueAt(doc, key);
  before.lastActivityAt = doc.lastActivityAt ?? null;
  before.lastActivityId = doc.lastActivityId ?? null;

  const update: Record<string, unknown> = {
    $set: {
      ...plan.set,
      lastActivityAt: now,
      lastActivityId: activityId.toHexString(),
      updatedAt: now,
      updatedBy: userId,
    },
  };
  if (plan.push) update.$push = plan.push;

  const enquiries = await enquiriesCol();
  const result = await enquiries.findOneAndUpdate(
    { _id: doc._id, tenantId, updatedAt: doc.updatedAt },
    update,
    { returnDocument: "after" }
  );
  if (!result) throw new TransitionError("Someone else just updated this enquiry — reload and try again.");

  await (await activitiesCol()).insertOne({
    _id: activityId,
    tenantId,
    entityType: "enquiry",
    entityId: doc._id.toHexString(),
    type: plan.activity.type,
    direction: null,
    body: plan.activity.body,
    occurredAt: now,
    createdBy: userId,
    meta: {
      ...(plan.activity.meta ?? {}),
      note: plan.activity.note ?? null,
      from: doc.status,
      to: result.status,
      ...(params.undoable === false || plan.push ? {} : { before }),
    },
    createdAt: now,
  });

  await afterStageChange(tenantId, doc, result);
  return { enquiry: result, activityId: activityId.toHexString() };
}

/** The lead becoming a customer, and the brand's won/lost rollups. */
async function afterStageChange(tenantId: string, before: EnquiryMongo, after: EnquiryMongo): Promise<void> {
  if (after.status === "confirmed" && before.status !== "confirmed" && after.contactId) {
    await (await contactsCol()).updateOne(
      { _id: toObjectId(after.contactId), tenantId },
      { $set: { isCustomer: true, updatedAt: new Date() } }
    );
  }
  const touchesRollup = (s: string) => s === "confirmed" || s === "done" || s === "lost" || s === "cancelled";
  if (after.brandId && (touchesRollup(before.status) || touchesRollup(after.status) || before.booking?.grossValue !== after.booking?.grossValue)) {
    await recomputeBrandRollups(tenantId, after.brandId);
  }
}

/**
 * Undo the last workflow action on an enquiry — only by the person who did
 * it, only within UNDO_WINDOW_MS, and only while nothing else has happened
 * to the enquiry since. Restores exactly the fields that action replaced.
 */
export async function undoActivity(tenantId: string, activityId: string, userId: string): Promise<EnquiryMongo> {
  const activities = await activitiesCol();
  const activity = await activities.findOne({ _id: toObjectId(activityId), tenantId });
  if (!activity || activity.entityType !== "enquiry") throw new NotFoundError("Activity");
  const meta = (activity.meta ?? {}) as { before?: Record<string, unknown>; undoneAt?: Date };
  if (!meta.before || meta.undoneAt) throw new TransitionError("That can't be undone.");
  if (activity.createdBy !== userId) throw new TransitionError("Only the person who saved it can undo it.");
  if (Date.now() - new Date(activity.createdAt).getTime() > UNDO_WINDOW_MS) {
    throw new TransitionError("Too late to undo — ask an admin to override the stage.");
  }

  const enquiries = await enquiriesCol();
  const current = await enquiries.findOne({ _id: toObjectId(activity.entityId), tenantId });
  if (!current) throw new NotFoundError("Enquiry");

  const restored = await enquiries.findOneAndUpdate(
    { _id: current._id, tenantId, lastActivityId: activityId },
    { $set: { ...meta.before, updatedAt: new Date(), updatedBy: userId } },
    { returnDocument: "after" }
  );
  if (!restored) throw new TransitionError("Something else has happened on this enquiry since — it can't be undone now.");

  await activities.updateOne({ _id: activity._id }, { $set: { "meta.undoneAt": new Date() } });
  await afterStageChange(tenantId, current, restored);
  return restored;
}
