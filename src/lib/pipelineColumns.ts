import type { EnquiryStatus } from "@/lib/enums";
import { allowedNextStatuses } from "@/lib/stateMachine/enquiryStatus";

/**
 * The Pipeline board's columns. Each groups one or more enquiry statuses,
 * so moving a card between columns *is* a status change — through the same
 * state machine as the status dropdown on the enquiry page. Client-safe.
 *
 * "Follow up" holds both On Hold (waiting on them) and Dormant (gone quiet,
 * revisit later): to whoever is working the board they're the same job —
 * chase this person on a date. "Closed" shows only the last 30 days; the
 * full history lives on the Enquiries page.
 */
export type ColumnKey = "new" | "in_progress" | "follow_up" | "confirmed" | "closed";

export interface ColumnDef {
  key: ColumnKey;
  title: string;
  /** Shown under the title, and as the empty state. */
  hint: string;
  statuses: EnquiryStatus[];
}

export const PIPELINE_COLUMNS: ColumnDef[] = [
  { key: "new", title: "New leads", hint: "Reply first", statuses: ["new_lead"] },
  { key: "in_progress", title: "In progress", hint: "Talking, options sent", statuses: ["in_progress"] },
  { key: "follow_up", title: "Follow up", hint: "Waiting on them", statuses: ["on_hold", "dormant"] },
  { key: "confirmed", title: "Confirmed", hint: "Booked, shoot ahead", statuses: ["confirmed"] },
  { key: "closed", title: "Closed", hint: "Last 30 days", statuses: ["completed", "lost", "cancelled"] },
];

export function columnFor(status: EnquiryStatus): ColumnKey {
  return PIPELINE_COLUMNS.find((c) => c.statuses.includes(status))!.key;
}

/**
 * What landing in a column means for a card coming from `from`:
 *  - "direct": one status, no questions (New, In progress).
 *  - "book": Confirmed — needs a studio, value and shoot date, so it opens
 *    the enquiry's Studios & booking card rather than guessing them.
 *  - "follow_up": asks when to chase and why, then On Hold + that date.
 *  - "close": asks how it ended (Completed / Lost / Cancelled — whichever
 *    `from` can reach) and why.
 * Null when the card can't go there at all.
 */
export type ColumnMove =
  | { kind: "direct"; to: EnquiryStatus }
  | { kind: "book" }
  | { kind: "follow_up" }
  | { kind: "close"; options: EnquiryStatus[] };

const DIRECT_TARGET: Partial<Record<ColumnKey, EnquiryStatus>> = {
  new: "new_lead",
  in_progress: "in_progress",
};

export function moveInto(column: ColumnKey, from: EnquiryStatus): ColumnMove | null {
  if (column === columnFor(from)) return null;
  const allowed = allowedNextStatuses(from);
  const direct = DIRECT_TARGET[column];
  if (direct) return allowed.includes(direct) ? { kind: "direct", to: direct } : null;
  if (column === "confirmed") return allowed.includes("confirmed") ? { kind: "book" } : null;
  if (column === "follow_up") return allowed.includes("on_hold") ? { kind: "follow_up" } : null;
  const options = (["completed", "lost", "cancelled"] as const).filter((s) => allowed.includes(s));
  return options.length ? { kind: "close", options: [...options] } : null;
}
