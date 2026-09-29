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
