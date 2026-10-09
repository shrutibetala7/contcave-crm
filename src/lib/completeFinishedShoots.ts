import { enquiriesCol } from "@/lib/db/collections";
import { planShootDone } from "@/lib/workflow";
import { applyPlan } from "@/lib/enquiryActions";
import { todayAsUtcMidnight } from "@/lib/businessDay";
import { TransitionError } from "@/lib/stateMachine/errors";

/**
 * The morning after the shoot date, a confirmed booking is Done — and its
 * follow-up becomes "send the feedback link". There's no background job in
 * this app, so this runs lazily whenever a list or an enquiry is opened; it
 * only ever touches Confirmed enquiries with a shoot date, so it's a small
 * indexed read on most loads.
 *
 * The last date wins: a shoot entered as a range (12–14 Oct) isn't done
 * until the 14th is behind us. applyPlan's conditional write means two page
 * loads racing each other can't complete (or log) it twice.
 */
export async function completeFinishedShoots(tenantId: string): Promise<void> {
  const enquiries = await enquiriesCol();
  const today = todayAsUtcMidnight().getTime();

  const candidates = await enquiries
    .find({ tenantId, status: "confirmed", "brief.preferredDates.0": { $exists: true } })
    .limit(500)
    .toArray();

  for (const doc of candidates) {
    const lastShootDay = Math.max(...doc.brief.preferredDates.map((d) => new Date(d).getTime()));
    if (lastShootDay >= today) continue;
    const now = new Date();
    try {
      const plan = planShootDone({ ...doc, reachable: true }, { now, userId: "system" });
      await applyPlan({ tenantId, doc, plan, userId: "system", now, undoable: false });
    } catch (e) {
      if (e instanceof TransitionError) continue; // someone else got there first
      throw e;
    }
  }
}
