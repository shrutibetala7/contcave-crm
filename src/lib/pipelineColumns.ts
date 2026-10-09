import type { EnquiryStatus, LogOutcome } from "@/lib/enums";

/**
 * The Pipeline board's columns — one per open stage, plus Closed (the last
 * 30 days of Done / Lost / Cancelled; the full history is on the Enquiries
 * page) and Parked (collapsed, out of every count). Client-safe.
 *
 * A card never changes stage by being dropped somewhere: the drop opens the
 * action that would move it there (see moveInto), and the stage follows
 * from what's recorded — same as on the enquiry page.
 */
export type ColumnKey = "new" | "talking" | "options_sent" | "confirmed" | "closed" | "parked";

export interface ColumnDef {
  key: ColumnKey;
  title: string;
  /** Shown under the title, and as the empty state. */
  hint: string;
  statuses: EnquiryStatus[];
}

export const PIPELINE_COLUMNS: ColumnDef[] = [
  { key: "new", title: "New", hint: "Reply first", statuses: ["new"] },
  { key: "talking", title: "Talking", hint: "In conversation", statuses: ["talking"] },
  { key: "options_sent", title: "Options sent", hint: "Waiting for them to pick", statuses: ["options_sent"] },
  { key: "confirmed", title: "Confirmed", hint: "Booked, shoot ahead", statuses: ["confirmed"] },
  { key: "closed", title: "Closed", hint: "Last 30 days", statuses: ["done", "lost", "cancelled"] },
  { key: "parked", title: "Parked", hint: "Stopped replying — revive if they come back", statuses: ["parked"] },
];

/** Columns that hold live work — what "open" and "overdue" count. */
export const LIVE_COLUMNS: ColumnKey[] = ["new", "talking", "options_sent", "confirmed"];

export function columnFor(status: EnquiryStatus): ColumnKey {
  return PIPELINE_COLUMNS.find((c) => c.statuses.includes(status))?.key ?? "closed";
}

/**
 * What dropping a card from `from` into `column` opens:
 *  - "log": the Log update sheet, with this outcome picked.
 *  - "studios": the enquiry's Studios & booking card — sending options and
 *    booking both happen there.
 *  - "revive": the Revive form (a parked lead that's back in touch).
 * Null when nothing ops can do moves it there (New, Parked and Done are
 * reached only by the system).
 */
export type ColumnMove = { kind: "log"; outcome: LogOutcome } | { kind: "studios" } | { kind: "revive" };

export function moveInto(column: ColumnKey, from: EnquiryStatus): ColumnMove | null {
  if (column === columnFor(from)) return null;
  if (from === "parked") return column === "talking" ? { kind: "revive" } : null;
  const open = from === "new" || from === "talking" || from === "options_sent" || from === "confirmed";
  if (!open) return null;
  switch (column) {
    case "talking":
      return from === "new" ? { kind: "log", outcome: "replied" } : null;
    case "options_sent":
      return from === "confirmed" ? null : { kind: "studios" };
    case "confirmed":
      return { kind: "studios" };
    case "closed":
      return { kind: "log", outcome: "not_going_ahead" };
    default:
      return null;
  }
}
