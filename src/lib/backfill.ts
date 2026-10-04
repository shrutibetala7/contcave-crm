/**
 * Older enquiries were entered in bulk on 30 Sep 2026: each one walked New
 * Lead → Confirmed → Completed within the same minute. Their status
 * timestamps (activity times, outcome.closedAt) are the day they were typed
 * in, not when anything happened — so time-to-close, stage conversion or
 * any "last N days" trend that reaches back past this date is meaningless.
 * Client-safe.
 */
export const BACKFILL_CUTOFF = new Date("2026-10-01T00:00:00.000+05:30");
export const BACKFILL_LABEL = "30 Sep 2026";

/** Was this record (or event) entered during the backfill? */
export function isBackfilled(date: Date | string | null | undefined): boolean {
  return date != null && new Date(date).getTime() < BACKFILL_CUTOFF.getTime();
}
