import { ObjectId } from "mongodb";
import { enquiriesCol, contactsCol, brandsCol, type EnquiryMongo } from "@/lib/db/collections";
import { listUsers } from "@/lib/users";
import { CANCEL_REASON_LABELS, LOSS_REASON_LABELS, type EnquiryStatus } from "@/lib/enums";
import { enquiryDisplayName } from "@/lib/enquiryDisplayName";
import { dayKey, daysFromToday, formatShortDay, formatWeekday } from "@/lib/businessDay";
import { estimatedValue, formatINR } from "@/lib/money";
import { LIVE_COLUMNS, PIPELINE_COLUMNS, columnFor, type ColumnKey } from "@/lib/pipelineColumns";
import { BACKFILL_CUTOFF } from "@/lib/backfill";
import { arrivedAt, isAwaitingReplyTooLong, isUnreachable } from "@/lib/leadHygiene";
import { getWorkflowSettings } from "@/lib/settings";
import type { FollowUp } from "@/lib/validation/enquiry";
import type { LogTarget } from "@/lib/workflow";

export type DueTone = "overdue" | "today" | "soon" | "later";

/** Everything a board card shows, pre-formatted on the server in India time. */
export interface PipelineCard {
  id: string;
  code: string;
  status: EnquiryStatus;
  column: ColumnKey;
  title: string;
  subtitle: string | null;
  /** "Fashion · New Delhi" */
  detail: string | null;
  /** "Shoot 12 Oct" / "Shoot 12–14 Oct" */
  shootLabel: string | null;
  /** Booking value, on won bookings. */
  valueLabel: string | null;
  /** "~₹40,000" — what an open lead is likely worth (quote or budget). */
  estimateLabel: string | null;
  /** The one open follow-up. `date` is YYYY-MM-DD in India time, for prefilling a date input. */
  follow: { label: string; tone: DueTone; reason: string | null; date: string; kind: FollowUp["kind"] } | null;
  /** An open card with no follow-up — shouldn't exist (the API refuses it), flagged if old data has one. */
  needsFollowUpDate: boolean;
  /** No-replies logged in a row, e.g. 2 — shown as "2 of 3" so ops know parking is close. */
  noReplyCount: number;
  /** "Came in today" / "Came in 3d ago" — for new leads, how long they've waited. */
  ageLabel: string | null;
  /** A new lead still without a first reply past the response-time target. */
  replyOverdue: boolean;
  /** Closed cards: "Completed", "Lost · Price". */
  outcomeLabel: string | null;
  ownerName: string | null;
  phone: string | null;
  instagramHandle: string | null;
  /** Follow-up is today or overdue (live columns only). */
  isDue: boolean;
  /** For the Log update sheet. */
  log: LogTarget;
}

export interface PipelineColumnData {
  key: ColumnKey;
  cards: PipelineCard[];
  /** Sum of booking values in the column, where that means something (Confirmed). */
  totalLabel: string | null;
}

const CLOSED_WINDOW_DAYS = 30;
const humanise = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function followLabel(days: number, date: Date): { label: string; tone: DueTone } {
  if (days < 0) return { label: `Overdue ${-days}d`, tone: "overdue" };
  if (days === 0) return { label: "Today", tone: "today" };
  if (days === 1) return { label: "Tomorrow", tone: "soon" };
  if (days < 7) return { label: formatWeekday(date), tone: "soon" };
  return { label: formatShortDay(date), tone: "later" };
}

/**
 * How urgent a follow-up is. All-day ones go overdue the day after; timed
 * ones (first reply, options check) the moment they pass — "Overdue 3h".
 */
export function followTone(f: Pick<FollowUp, "dueAt" | "allDay">, now: Date): { label: string; tone: DueTone } {
  const due = new Date(f.dueAt);
  if (!f.allDay && due < now) {
    const hours = Math.floor((now.getTime() - due.getTime()) / 3_600_000);
    return hours < 24 ? { label: `Overdue ${Math.max(hours, 1)}h`, tone: "overdue" } : { label: `Overdue ${Math.floor(hours / 24)}d`, tone: "overdue" };
  }
  return followLabel(daysFromToday(due, now), due);
}

function shootLabel(dates: Date[]): string | null {
  if (!dates.length) return null;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const first = formatShortDay(sorted[0]);
  const last = formatShortDay(sorted[sorted.length - 1]);
  if (first === last) return `Shoot ${first}`;
  const [d1, m1] = first.split(" ");
  const [d2, m2] = last.split(" ");
  return m1 === m2 ? `Shoot ${d1}–${d2} ${m2}` : `Shoot ${first} – ${last}`;
}

function outcomeLabel(e: EnquiryMongo): string | null {
  if (e.status === "done") return "Done";
  if (e.status === "lost") return e.outcome?.lossReason ? `Lost · ${LOSS_REASON_LABELS[e.outcome.lossReason]}` : "Lost";
  if (e.status === "parked") return e.outcome?.lossReason ? LOSS_REASON_LABELS[e.outcome.lossReason] : null;
  if (e.status === "cancelled") {
    const reason = e.outcome?.cancelReason;
    return reason ? `Cancelled · ${reason === "other" ? e.outcome?.cancelNote || "Other" : CANCEL_REASON_LABELS[reason]}` : "Cancelled";
  }
  return null;
}

export async function getPipeline(tenantId: string, options: { ownerId?: string } = {}) {
  const now = new Date();
  const closedSince = new Date(now.getTime() - CLOSED_WINDOW_DAYS * 86_400_000);
  // Backfilled records carry the backfill day as their closedAt, which would
  // put months-old enquiries in "last 30 days" — so a closing date before the
  // cutoff is never trusted. Completed shoots go by their shoot date instead;
  // backfilled lost/cancelled ones by when the enquiry came in.
  const trustedSince = new Date(Math.max(closedSince.getTime(), BACKFILL_CUTOFF.getTime()));
  const owner = options.ownerId ? { ownerId: options.ownerId } : {};

  const enquiries = await enquiriesCol();
  const settings = await getWorkflowSettings(tenantId);
  const docs = await enquiries
    .find({
      tenantId,
      ...owner,
      $or: [
        { status: { $in: ["new", "talking", "options_sent", "confirmed", "parked"] } },
        { status: "done", "brief.preferredDates": { $elemMatch: { $gte: closedSince } } },
        { status: "done", "brief.preferredDates.0": { $exists: false }, "outcome.closedAt": { $gte: trustedSince } },
        { status: { $in: ["lost", "cancelled"] }, "outcome.closedAt": { $gte: trustedSince } },
        {
          status: { $in: ["lost", "cancelled"] },
          "outcome.closedAt": { $lt: BACKFILL_CUTOFF },
          $or: [{ enquiryDate: { $gte: closedSince } }, { enquiryDate: null, createdAt: { $gte: closedSince } }],
        },
      ],
    })
    .limit(1000)
    .toArray();

  const contactIds = [...new Set(docs.map((d) => d.contactId).filter((v): v is string => Boolean(v)))];
  const brandIds = [...new Set(docs.map((d) => d.brandId).filter((v): v is string => Boolean(v)))];
  const [contacts, brands, users] = await Promise.all([
    contactIds.length
      ? (await contactsCol()).find({ tenantId, _id: { $in: contactIds.map((id) => new ObjectId(id)) } }).toArray()
      : [],
    brandIds.length
      ? (await brandsCol()).find({ tenantId, _id: { $in: brandIds.map((id) => new ObjectId(id)) } }).toArray()
      : [],
    listUsers(tenantId),
  ]);
  const contactById = new Map(contacts.map((c) => [c._id.toHexString(), c]));
  const brandById = new Map(brands.map((b) => [b._id.toHexString(), b.name]));
  const userById = new Map(users.map((u) => [u.id, u.name]));

  // Sort keys kept beside each card rather than on it — they're not for display.
  const rows = docs.map((e) => {
    const contact = e.contactId ? contactById.get(e.contactId) : undefined;
    const { title, subtitle } = enquiryDisplayName({
      code: e.code,
      contactName: contact?.name,
      brandName: e.brandId ? brandById.get(e.brandId) : null,
      instagramHandle: contact?.instagramHandle,
      phone: contact?.phone,
      industry: e.industry ?? null,
      query: e.brief?.rawText,
    });
    const column = columnFor(e.status);
    const live = LIVE_COLUMNS.includes(column);
    const follow = e.followUp ?? null;
    const tone = follow ? followTone(follow, now) : null;
    const enquiryDate = arrivedAt(e);
    const estimate = live && column !== "confirmed" ? estimatedValue(e) : null;
    const ageDays = -daysFromToday(enquiryDate, now);
    const shootDates = (e.brief?.preferredDates ?? []).map((d) => new Date(d));
    const won = e.status === "confirmed" || e.status === "done";

    const card: PipelineCard = {
      id: e._id.toHexString(),
      code: e.code,
      status: e.status,
      column,
      title,
      subtitle,
      detail: [e.brief?.shootType ? humanise(e.brief.shootType) : null, e.brief?.city].filter(Boolean).join(" · ") || null,
      shootLabel: shootLabel(shootDates),
      valueLabel: won && e.booking?.grossValue ? formatINR(e.booking.grossValue) : null,
      estimateLabel: estimate ? `~${formatINR(estimate)}` : null,
      follow: follow && tone ? { ...tone, reason: follow.label, date: dayKey(follow.dueAt), kind: follow.kind } : null,
      needsFollowUpDate: live && !follow,
      noReplyCount: e.noReplyCount ?? 0,
      ageLabel: column === "new" ? (ageDays <= 0 ? "Came in today" : `Came in ${ageDays}d ago`) : null,
      replyOverdue: isAwaitingReplyTooLong(e, settings.firstReplyHours, now),
      outcomeLabel: outcomeLabel(e),
      ownerName: e.ownerId ? userById.get(e.ownerId) ?? null : null,
      phone: contact?.whatsappNumber ?? contact?.phone ?? null,
      instagramHandle: contact?.instagramHandle ?? null,
      isDue: live && (tone?.tone === "overdue" || tone?.tone === "today"),
      log: {
        id: e._id.toHexString(),
        title,
        status: e.status,
        noReplyCount: e.noReplyCount ?? 0,
        noReplyStartedAt: e.noReplyStartedAt ? new Date(e.noReplyStartedAt).toISOString() : null,
        firstResponseAt: e.firstResponseAt ? new Date(e.firstResponseAt).toISOString() : null,
        reachable: !isUnreachable(contact),
        preferredDates: shootDates.map((d) => d.toISOString()),
      },
    };
    const firstShoot = shootDates.length ? Math.min(...shootDates.map((d) => d.getTime())) : Infinity;
    const lastShoot = shootDates.length ? Math.max(...shootDates.map((d) => d.getTime())) : null;
    const closedAt = e.status === "done" && lastShoot != null ? lastShoot : new Date(e.outcome?.closedAt ?? e.updatedAt).getTime();
    // Nobody can work a lead with no phone and no Instagram — it waits in a
    // holding queue above the board until someone fills in who it is.
    const holding = live && column !== "confirmed" && isUnreachable(contact);
    return { card, holding, followAt: follow ? new Date(follow.dueAt).getTime() : Infinity, enquiryAt: enquiryDate.getTime(), closedAt, firstShoot, gross: won ? e.booking?.grossValue ?? 0 : 0 };
  });

  type Row = (typeof rows)[number];
  // Anything with a date to chase comes first, soonest (i.e. most overdue) on
  // top; then the rest, newest enquiry first.
  const byFollowThenNewest = (a: Row, b: Row) => a.followAt - b.followAt || b.enquiryAt - a.enquiryAt;
  const ORDER: Record<ColumnKey, (a: Row, b: Row) => number> = {
    new: byFollowThenNewest,
    talking: byFollowThenNewest,
    options_sent: byFollowThenNewest,
    confirmed: (a, b) => a.firstShoot - b.firstShoot || b.enquiryAt - a.enquiryAt,
    closed: (a, b) => b.closedAt - a.closedAt,
    parked: byFollowThenNewest,
  };

  const onBoard = rows.filter((r) => !r.holding);
  const columns: PipelineColumnData[] = PIPELINE_COLUMNS.map((col) => {
    const inColumn = onBoard.filter((r) => r.card.column === col.key).sort(ORDER[col.key]);
    const total = inColumn.reduce((sum, r) => sum + r.gross, 0);
    return {
      key: col.key,
      cards: inColumn.map((r) => r.card),
      totalLabel: col.key === "confirmed" && total > 0 ? formatINR(total) : null,
    };
  });

  const open = onBoard.filter((r) => LIVE_COLUMNS.includes(r.card.column)).map((r) => r.card);
  const holding = rows
    .filter((r) => r.holding)
    .sort((a, b) => b.enquiryAt - a.enquiryAt)
    .map((r) => r.card);
  return {
    columns,
    holding,
    users,
    counts: {
      open: open.length,
      overdue: open.filter((c) => c.follow?.tone === "overdue").length,
      dueToday: open.filter((c) => c.follow?.tone === "today").length,
      awaitingReply: open.filter((c) => c.replyOverdue).length,
    },
  };
}
