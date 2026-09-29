/**
 * "Today" for this business is the calendar day in India, whatever timezone
 * the server happens to run in. Dates typed into date inputs are stored as
 * UTC midnight of that calendar date (e.g. 2026-10-05T00:00Z), which is
 * 05:30 the same day in IST, so reading them back in IST gives the date
 * that was typed. Client-safe: no server-only imports.
 */
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD of `date` in India. */
export function dayKey(date: Date | string): string {
  return dayFormatter.format(new Date(date));
}

/** Today's calendar date as UTC midnight — the same shape stored dates have. */
export function todayAsUtcMidnight(now: Date = new Date()): Date {
  return new Date(`${dayKey(now)}T00:00:00.000Z`);
}

const shortDay = new Intl.DateTimeFormat("en-IN", { timeZone: BUSINESS_TIME_ZONE, day: "numeric", month: "short" });
const weekday = new Intl.DateTimeFormat("en-IN", { timeZone: BUSINESS_TIME_ZONE, weekday: "short" });

/** "12 Oct" */
export function formatShortDay(date: Date | string): string {
  return shortDay.format(new Date(date));
}

/** "Thu" */
export function formatWeekday(date: Date | string): string {
  return weekday.format(new Date(date));
}

/** Whole calendar days from today to `date` (negative = in the past). */
export function daysFromToday(date: Date | string, now: Date = new Date()): number {
  const target = Date.parse(`${dayKey(date)}T00:00:00.000Z`);
  const today = Date.parse(`${dayKey(now)}T00:00:00.000Z`);
  return Math.round((target - today) / 86_400_000);
}
