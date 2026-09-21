import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { ObjectId } from "mongodb";
import {
  enquiriesCol,
  contactsCol,
  brandsCol,
  activitiesCol,
  type EnquiryMongo,
} from "@/lib/db/collections";
import { listUsers } from "@/lib/users";
import { TODAY_RANGES, type TodayRange } from "@/lib/todayRanges";

// Re-exported for server-side callers' convenience (e.g. today/page.tsx) —
// but any Client Component must import from "@/lib/todayRanges" directly,
// never through this module: this file also imports the Mongo driver
// (server-only), and a re-export doesn't stop a bundler from trying to
// resolve that for the browser too — the module-not-found happens at
// resolution time, before any tree-shaking of unused exports.
export type { TodayRange } from "@/lib/todayRanges";
export { TODAY_RANGES } from "@/lib/todayRanges";

export type DueBucket = "overdue" | "today" | "thisWeek";

export interface DueItem {
  kind: "enquiry_next_action" | "delay_follow_up" | "new_unactioned";
  bucket: DueBucket;
  dueDate: string;
  entityType: "enquiry";
  entityId: string;
  /** Change Brief v1.1 §B — the row's primary line. Null renders as an amber "no reason recorded". */
  reason: string | null;
  /** Brand name — secondary line. */
  title: string;
  code: string;
  ownerId: string | null;
  ownerName: string | null;
  overdueDays: number | null;
  contactPhone: string | null;
  href: string;
  /** Only set for kind: "delay_follow_up" — needed to PATCH the right delay event when snoozing. */
  delayId?: string;
}

function bucketFor(date: Date, startToday: Date, startTomorrow: Date): DueBucket {
  if (date < startToday) return "overdue";
  if (date < startTomorrow) return "today";
  return "thisWeek";
}

function overdueDaysFor(date: Date, startToday: Date): number | null {
  if (date >= startToday) return null;
  return Math.max(1, differenceInCalendarDays(startToday, date));
}

export interface GetDueItemsOptions {
  ownerId?: string;
  range?: TodayRange;
}

export async function getDueItems(tenantId: string, options: GetDueItemsOptions = {}) {
  const now = new Date();
  const startToday = startOfDay(now);
  const startTomorrow = addDays(startToday, 1);
  const rangeDays = TODAY_RANGES[options.range ?? "week"];
  const weekEnd = addDays(startToday, rangeDays + 1); // +1: "this week" includes today through rangeDays out

  const enquiries = await enquiriesCol();
  const contacts = await contactsCol();
  const brands = await brandsCol();

  const ownerFilter = options.ownerId ? { ownerId: options.ownerId } : {};

  const [dueEnquiries, delayEnquiries, newUnactioned] = await Promise.all([
    enquiries
      .find({ tenantId, ...ownerFilter, nextActionDate: { $ne: null, $lt: weekEnd } })
      .limit(300)
      .toArray(),
    enquiries
      .find({
        tenantId,
        ...ownerFilter,
        "schedule.delayEvents": {
          $elemMatch: { resolved: false, followUpOn: { $ne: null, $lt: weekEnd } },
        },
      })
      .limit(300)
      .toArray(),
    enquiries
      .find({ tenantId, ...ownerFilter, status: "new", nextActionDate: null })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray(),
  ]);

  const allEnquiriesForJoins = [...dueEnquiries, ...delayEnquiries, ...newUnactioned];
  const contactIds = Array.from(
    new Set(allEnquiriesForJoins.map((e) => e.contactId).filter((id): id is string => Boolean(id)))
  );
  const brandIds = Array.from(
    new Set(allEnquiriesForJoins.map((e) => e.brandId).filter((id): id is string => Boolean(id)))
  );

  // Team is 5 people (spec §7) — fetching everyone is simpler and cheaper
  // than computing the exact owner-id set involved.
  const [contactDocs, brandDocs, users] = await Promise.all([
    contactIds.length
      ? contacts.find({ tenantId, _id: { $in: contactIds.map((id) => new ObjectId(id)) } }).toArray()
      : Promise.resolve([]),
    brandIds.length
      ? brands.find({ tenantId, _id: { $in: brandIds.map((id) => new ObjectId(id)) } }).toArray()
      : Promise.resolve([]),
    listUsers(tenantId),
  ]);

  const phoneByContactId = new Map(contactDocs.map((c) => [c._id.toHexString(), c.whatsappNumber || c.phone]));
  const brandNameById = new Map(brandDocs.map((b) => [b._id.toHexString(), b.name]));
  const ownerNameById = new Map(users.map((u) => [u.id, u.name]));

  function enquiryTitle(e: EnquiryMongo): string {
    return (e.brandId && brandNameById.get(e.brandId)) || e.code;
  }

  const items: DueItem[] = [];

  for (const e of dueEnquiries) {
    if (!e.nextActionDate) continue;
    items.push({
      kind: "enquiry_next_action",
      bucket: bucketFor(e.nextActionDate, startToday, startTomorrow),
      dueDate: e.nextActionDate.toISOString(),
      entityType: "enquiry",
      entityId: e._id.toHexString(),
      reason: e.nextActionReason ?? null,
      title: enquiryTitle(e),
      code: e.code,
      ownerId: e.ownerId ?? null,
      ownerName: e.ownerId ? ownerNameById.get(e.ownerId) ?? null : null,
      overdueDays: overdueDaysFor(e.nextActionDate, startToday),
      contactPhone: e.contactId ? phoneByContactId.get(e.contactId) ?? null : null,
      href: `/enquiries/${e._id.toHexString()}`,
    });
  }

  for (const e of delayEnquiries) {
    const unresolved = e.schedule.delayEvents
      .filter((d) => !d.resolved && d.followUpOn && d.followUpOn < weekEnd)
      .sort((a, b) => (a.followUpOn as Date).getTime() - (b.followUpOn as Date).getTime())[0];
    if (!unresolved?.followUpOn) continue;
    items.push({
      kind: "delay_follow_up",
      bucket: bucketFor(unresolved.followUpOn, startToday, startTomorrow),
      dueDate: unresolved.followUpOn.toISOString(),
      entityType: "enquiry",
      entityId: e._id.toHexString(),
      reason: unresolved.followUpReason ?? null,
      title: enquiryTitle(e),
      code: e.code,
      ownerId: e.ownerId ?? null,
      ownerName: e.ownerId ? ownerNameById.get(e.ownerId) ?? null : null,
      overdueDays: overdueDaysFor(unresolved.followUpOn, startToday),
      contactPhone: e.contactId ? phoneByContactId.get(e.contactId) ?? null : null,
      href: `/enquiries/${e._id.toHexString()}`,
      delayId: unresolved.id,
    });
  }

  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const newUnactionedItems: DueItem[] = newUnactioned.map((e) => ({
    kind: "new_unactioned",
    bucket: "today",
    dueDate: e.createdAt.toISOString(),
    entityType: "enquiry",
    entityId: e._id.toHexString(),
    reason: null,
    title: enquiryTitle(e),
    code: e.code,
    ownerId: e.ownerId ?? null,
    ownerName: e.ownerId ? ownerNameById.get(e.ownerId) ?? null : null,
    overdueDays: null,
    contactPhone: e.contactId ? phoneByContactId.get(e.contactId) ?? null : null,
    href: `/enquiries/${e._id.toHexString()}`,
  }));

  return {
    overdue: items.filter((i) => i.bucket === "overdue"),
    today: items.filter((i) => i.bucket === "today"),
    thisWeek: items.filter((i) => i.bucket === "thisWeek"),
    newUnactioned: newUnactionedItems,
  };
}

export interface TodayMetrics {
  outcomeCoveragePct: number | null;
  medianFirstResponseHours: number | null;
  revivedCount: number;
}

/** spec §8 — the three numbers on the Today screen footer. */
export async function getMetrics(tenantId: string): Promise<TodayMetrics> {
  const enquiries = await enquiriesCol();
  const activities = await activitiesCol();
  const fourteenDaysAgo = addDays(new Date(), -14);

  const [olderCount, olderWithOutcome, respondedDocs, wonIds] = await Promise.all([
    enquiries.countDocuments({ tenantId, createdAt: { $lt: fourteenDaysAgo } }),
    enquiries.countDocuments({
      tenantId,
      createdAt: { $lt: fourteenDaysAgo },
      "outcome.result": { $ne: null },
    }),
    enquiries
      .find({ tenantId, firstResponseAt: { $ne: null } }, { projection: { createdAt: 1, firstResponseAt: 1 } })
      .limit(2000)
      .toArray(),
    enquiries.find({ tenantId, status: "closed_won" }, { projection: { _id: 1 } }).limit(5000).toArray(),
  ]);

  const outcomeCoveragePct = olderCount > 0 ? Math.round((olderWithOutcome / olderCount) * 1000) / 10 : null;

  let medianFirstResponseHours: number | null = null;
  if (respondedDocs.length > 0) {
    const hours = respondedDocs
      .filter((d) => d.firstResponseAt)
      .map((d) => ((d.firstResponseAt as Date).getTime() - d.createdAt.getTime()) / 3_600_000)
      .sort((a, b) => a - b);
    const mid = Math.floor(hours.length / 2);
    medianFirstResponseHours =
      hours.length % 2 === 0 ? Math.round(((hours[mid - 1] + hours[mid]) / 2) * 10) / 10 : Math.round(hours[mid] * 10) / 10;
  }

  const wonIdStrings = wonIds.map((d) => d._id.toHexString());
  const revivedCount = wonIdStrings.length
    ? (
        await activities.distinct("entityId", {
          tenantId,
          entityType: "enquiry",
          entityId: { $in: wonIdStrings },
          type: "status_change",
          "meta.from": "dormant",
          "meta.to": "contacted",
        })
      ).length
    : 0;

  return { outcomeCoveragePct, medianFirstResponseHours, revivedCount };
}
