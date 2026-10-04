import { enquiriesCol, type EnquiryMongo } from "@/lib/db/collections";
import { assertValidTransition } from "@/lib/stateMachine/enquiryStatus";
import { writeStatusChangeActivity } from "@/lib/activity";
import { todayAsUtcMidnight } from "@/lib/businessDay";

/** First reply should go out within this long of a lead coming in. */
export const FIRST_REPLY_TARGET_HOURS = 2;
/** An open lead nobody has touched in this many days is parked automatically. */
export const AUTO_PARK_DAYS = 14;
/** When an auto-parked lead comes back up for a look. */
const AUTO_PARK_REVISIT_DAYS = 30;

const DAY = 86_400_000;

/**
 * When the lead arrived, as precisely as we know. `enquiryDate` is a calendar
 * day (UTC midnight); when the record was made that same day, `createdAt`
 * carries the actual time.
 */
export function arrivedAt(e: Pick<EnquiryMongo, "enquiryDate" | "createdAt">): Date {
  const created = new Date(e.createdAt);
  if (!e.enquiryDate) return created;
  const day = new Date(e.enquiryDate);
  return created.getTime() - day.getTime() < DAY && created >= day ? created : day;
}

/** A New Lead still waiting for its first reply past the target. */
export function isAwaitingReplyTooLong(
  e: Pick<EnquiryMongo, "status" | "firstResponseAt" | "enquiryDate" | "createdAt">,
  now: Date = new Date()
): boolean {
  if (e.status !== "new_lead" || e.firstResponseAt) return false;
  return now.getTime() - arrivedAt(e).getTime() > FIRST_REPLY_TARGET_HOURS * 3_600_000;
}

/** A lead nobody can act on: no phone and no Instagram to reach them on. */
export function isUnreachable(contact: { phone?: string | null; instagramHandle?: string | null } | null | undefined): boolean {
  return !contact?.phone && !contact?.instagramHandle;
}

/**
 * Park open leads that have gone untouched for AUTO_PARK_DAYS, so the board
 * only shows work someone is actually doing. "Untouched" means:
 *  - a New Lead that came in that long ago and never got a reply, or
 *  - an In Progress / On Hold lead with no edit, contact or follow-up date
 *    in that long (a follow-up date still ahead keeps it live).
 * Runs lazily on page load, like completeFinishedShoots — there's no
 * background job. The reason is recorded as "We didn't follow up", so the
 * loss report shows it as our miss, not the client's.
 */
export async function autoParkStaleLeads(tenantId: string, now: Date = new Date()): Promise<void> {
  const enquiries = await enquiriesCol();
  const cutoff = new Date(now.getTime() - AUTO_PARK_DAYS * DAY);
  const today = todayAsUtcMidnight(now);

  const candidates = await enquiries
    .find({
      tenantId,
      $or: [
        {
          status: "new_lead",
          firstResponseAt: null,
          // enquiryDate, not createdAt: backfilled leads were all created on the backfill day.
          $or: [{ enquiryDate: { $lt: cutoff } }, { enquiryDate: null, createdAt: { $lt: cutoff } }],
        },
        {
          status: { $in: ["in_progress", "on_hold"] },
          updatedAt: { $lt: cutoff },
          $and: [
            { $or: [{ lastContactedAt: null }, { lastContactedAt: { $lt: cutoff } }] },
            { $or: [{ nextActionDate: null }, { nextActionDate: { $lt: cutoff } }] },
          ],
        },
      ],
    })
    .limit(200)
    .toArray();

  for (const e of candidates) {
    // An open delay follow-up still ahead is someone's plan for this lead.
    if (e.schedule?.delayEvents?.some((d) => !d.resolved && d.followUpOn && new Date(d.followUpOn) >= today)) continue;

    const revisit = new Date(today.getTime() + AUTO_PARK_REVISIT_DAYS * DAY);
    const { set } = assertValidTransition(e, "dormant", {
      to: "dormant",
      lossReason: "not_followed_up",
      nextActionDate: revisit,
      nextActionReason: `Auto-parked: untouched for ${AUTO_PARK_DAYS} days`,
    });
    delete set.firstResponseAt; // nobody replied — parking isn't a response

    const updated = await enquiries.findOneAndUpdate(
      { _id: e._id, tenantId, status: e.status, updatedAt: e.updatedAt },
      { $set: { ...set, updatedAt: now, updatedBy: "system" } }
    );
    if (!updated) continue;

    await writeStatusChangeActivity({
      tenantId,
      entityType: "enquiry",
      entityId: e._id.toHexString(),
      from: e.status,
      to: "dormant",
      note: `Nobody touched this for ${AUTO_PARK_DAYS} days — parked automatically.`,
      createdBy: "system",
    });
  }
}
