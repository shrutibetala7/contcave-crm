import { enquiriesCol } from "@/lib/db/collections";
import { assertValidTransition } from "@/lib/stateMachine/enquiryStatus";
import { writeStatusChangeActivity } from "@/lib/activity";
import { todayAsUtcMidnight } from "@/lib/businessDay";

/**
 * After the shoot date, a confirmed booking is a completed one. There's no
 * background job in this app, so this runs lazily whenever the enquiries
 * list or an enquiry is opened — it only ever touches Confirmed enquiries
 * that have a shoot date, so it's a small indexed read on most loads.
 *
 * The last date wins: a shoot entered as a range (12–14 Oct) isn't complete
 * until the 14th is behind us. The status change goes through the same
 * state machine as a manual one, and the conditional update means two
 * page loads racing each other can't complete (or log) it twice.
 */
export async function completeFinishedShoots(tenantId: string): Promise<void> {
  const enquiries = await enquiriesCol();
  const today = todayAsUtcMidnight().getTime();

  const candidates = await enquiries
    .find({ tenantId, status: "confirmed", "brief.preferredDates.0": { $exists: true } })
    .limit(500)
    .toArray();

  for (const enquiry of candidates) {
    const lastShootDay = Math.max(...enquiry.brief.preferredDates.map((d) => new Date(d).getTime()));
    if (lastShootDay >= today) continue;

    const { set } = assertValidTransition(enquiry, "completed", { to: "completed" });
    const updated = await enquiries.findOneAndUpdate(
      { _id: enquiry._id, tenantId, status: "confirmed" },
      { $set: { ...set, updatedAt: new Date(), updatedBy: "system" } }
    );
    if (!updated) continue; // someone else got there first

    await writeStatusChangeActivity({
      tenantId,
      entityType: "enquiry",
      entityId: enquiry._id.toHexString(),
      from: "confirmed",
      to: "completed",
      note: "Shoot date has passed — marked completed automatically.",
      createdBy: "system",
    });
  }
}
