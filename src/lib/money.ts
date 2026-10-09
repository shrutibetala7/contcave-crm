/**
 * ContCave's cut of a booking. A booking can carry its own
 * `commissionValue` (a negotiated exception); otherwise it's this share of
 * the booking's gross value. Client-safe: no server-only imports.
 */
export const COMMISSION_RATE = 0.12;
export const COMMISSION_RATE_LABEL = `${Math.round(COMMISSION_RATE * 100)}%`;

export function commissionFor(booking: { grossValue?: number | null; commissionValue?: number | null }): number {
  if (booking.commissionValue != null) return booking.commissionValue;
  return Math.round((booking.grossValue ?? 0) * COMMISSION_RATE);
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,24,000 — Indian digit grouping, no paise. */
export function formatINR(amount: number): string {
  return `₹${inr.format(amount)}`;
}

/**
 * What an open enquiry is likely worth, before anything is booked: the
 * chosen studio's quote, else the highest quote still in play, else the
 * client's stated budget. Null when there's nothing to go on.
 */
export function estimatedValue(e: {
  shortlist?: { outcome?: string | null; quotedAmount?: number | null }[] | null;
  brief?: { budgetMin?: number | null; budgetMax?: number | null } | null;
}): number | null {
  const quotes = (e.shortlist ?? []).filter((s) => s.quotedAmount != null && s.quotedAmount > 0);
  const picked = quotes.find((s) => s.outcome === "picked");
  if (picked) return picked.quotedAmount!;
  const live = quotes.filter((s) => s.outcome === "pending" || s.outcome == null);
  if (live.length) return Math.max(...live.map((s) => s.quotedAmount!));
  return e.brief?.budgetMax || e.brief?.budgetMin || null;
}

/** GST on bookings and on our commission. Every amount stored in the CRM is before GST. */
export const GST_RATE = 0.18;

export function withGst(amount: number): number {
  return Math.round(amount * (1 + GST_RATE));
}
