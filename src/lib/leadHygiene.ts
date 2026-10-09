import type { EnquiryMongo } from "@/lib/db/collections";

const DAY = 86_400_000;

/**
 * When the lead arrived, as precisely as we know. `enquiryDate` is a calendar
 * day (UTC midnight); when the record was made that same day, `createdAt`
 * carries the actual time. Client-safe.
 */
export function arrivedAt(e: Pick<EnquiryMongo, "enquiryDate" | "createdAt">): Date {
  const created = new Date(e.createdAt);
  if (!e.enquiryDate) return created;
  const day = new Date(e.enquiryDate);
  return created.getTime() - day.getTime() < DAY && created >= day ? created : day;
}

/** A New lead still waiting for its first reply past the target. */
export function isAwaitingReplyTooLong(
  e: Pick<EnquiryMongo, "status" | "firstResponseAt" | "enquiryDate" | "createdAt">,
  firstReplyHours: number,
  now: Date = new Date()
): boolean {
  if (e.status !== "new" || e.firstResponseAt) return false;
  return now.getTime() - arrivedAt(e).getTime() > firstReplyHours * 3_600_000;
}

/** A lead nobody can act on: no phone and no Instagram to reach them on. */
export function isUnreachable(contact: { phone?: string | null; instagramHandle?: string | null } | null | undefined): boolean {
  return !contact?.phone && !contact?.instagramHandle;
}
