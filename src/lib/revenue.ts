import { enquiriesCol } from "@/lib/db/collections";
import { commissionFor } from "@/lib/money";

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
    } else {
      summary.upcomingValue += gross;
      summary.upcomingCommission += commission;
      summary.upcomingCount++;
    }
  }
  return summary;
}
