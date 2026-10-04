import { enquiriesCol } from "@/lib/db/collections";
import { commissionFor, estimatedValue } from "@/lib/money";

export interface RevenueSummary {
  /** Gross value of every won booking (Confirmed + Completed). */
  bookedValue: number;
  /** ContCave's share of that — see lib/money.ts. */
  commission: number;
  /** Of which: shoots that have happened. */
  completedValue: number;
  completedCommission: number;
  completedCount: number;
  /** Of which: booked, shoot still ahead. */
  upcomingValue: number;
  upcomingCommission: number;
  upcomingCount: number;
  /** Won bookings with no value entered yet — they're counted as ₹0 above. */
  missingValueCount: number;
  /** Of completed commission: actually paid to us, vs. still owed. */
  receivedCommission: number;
  owedCommission: number;
  owedCount: number;
  /** Owed on shoots booked off-platform — we only know about them if the studio tells us. */
  owedOffPlatformCount: number;
  /** Live leads (New, In progress, Follow up): what they'd be worth if they all booked. */
  pipelineValue: number;
  pipelineCommission: number;
  pipelineEstimatedCount: number;
  pipelineUnestimatedCount: number;
}

/**
 * Money made so far. A booking counts once it's won (Confirmed), and is
 * split by whether the shoot has happened yet (Completed) — so "what we've
 * made" and "what's in the bag but not yet delivered" read separately.
 * Cancelled bookings drop out entirely.
 */
export async function getRevenueSummary(tenantId: string): Promise<RevenueSummary> {
  const enquiries = await enquiriesCol();
  const won = await enquiries
    .find(
      { tenantId, status: { $in: ["confirmed", "completed"] } },
      { projection: { status: 1, booking: 1 } }
    )
    .toArray();
  const live = await enquiries
    .find(
      { tenantId, status: { $in: ["new_lead", "in_progress", "on_hold"] } },
      { projection: { shortlist: 1, "brief.budgetMin": 1, "brief.budgetMax": 1 } }
    )
    .toArray();

  const summary: RevenueSummary = {
    bookedValue: 0,
    commission: 0,
    completedValue: 0,
    completedCommission: 0,
    completedCount: 0,
    upcomingValue: 0,
    upcomingCommission: 0,
    upcomingCount: 0,
    missingValueCount: 0,
    receivedCommission: 0,
    owedCommission: 0,
    owedCount: 0,
    owedOffPlatformCount: 0,
    pipelineValue: 0,
    pipelineCommission: 0,
    pipelineEstimatedCount: 0,
    pipelineUnestimatedCount: 0,
  };

  for (const e of won) {
    const gross = e.booking?.grossValue ?? 0;
    const commission = commissionFor(e.booking ?? {});
    if (!e.booking?.grossValue && e.booking?.commissionValue == null) summary.missingValueCount++;
    summary.bookedValue += gross;
    summary.commission += commission;
    if (e.status === "completed") {
      summary.completedValue += gross;
      summary.completedCommission += commission;
      summary.completedCount++;
      if (e.booking?.commissionReceivedAt) {
        summary.receivedCommission += commission;
      } else {
        summary.owedCommission += commission;
        summary.owedCount++;
        if (!e.booking?.platformBookingId) summary.owedOffPlatformCount++;
      }
    } else {
      summary.upcomingValue += gross;
      summary.upcomingCommission += commission;
      summary.upcomingCount++;
    }
  }

  for (const e of live) {
    const value = estimatedValue(e);
    if (value) {
      summary.pipelineValue += value;
      summary.pipelineCommission += commissionFor({ grossValue: value });
      summary.pipelineEstimatedCount++;
    } else {
      summary.pipelineUnestimatedCount++;
    }
  }
  return summary;
}
