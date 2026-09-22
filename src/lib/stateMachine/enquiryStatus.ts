import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/lib/enums";
import { TransitionError } from "@/lib/stateMachine/errors";
import type { Booking, Feedback, Schedule, ShortlistEntryDoc, StatusChangeInput } from "@/lib/validation/enquiry";

/**
 * spec §4.1. This is the *only* place enquiry.status transitions are
 * decided — API routes call assertValidTransition() and apply the
 * returned `set` patch; they never branch on status themselves.
 */

export interface EnquiryStateInput {
  status: EnquiryStatus;
  shortlist: ShortlistEntryDoc[];
  booking: Booking;
  schedule: Schedule;
  feedback: Feedback;
}

export interface TransitionResult {
  set: Record<string, unknown>;
}

const MAIN_SEQUENCE: EnquiryStatus[] = [
  "new",
  "contacted",
  "qualified",
  "shortlist_sent",
  "negotiating",
  "confirmed",
  "scheduled",
  "completed",
  "feedback_pending",
  "closed_won",
];

const TERMINAL_STATUSES = new Set<EnquiryStatus>(["closed_won", "lost"]);

// The early funnel, before anything is booked. Any of these can move to any
// other (a client can arrive already qualified, or go back to negotiating).
const EARLY = new Set<EnquiryStatus>(["new", "contacted", "qualified", "shortlist_sent", "negotiating"]);

// §4.1 allows "lost" up to and including confirmed, and from delayed. Two
// deliberate additions: "scheduled" (a client can cancel a booked shoot, and
// forcing that through a fake delay would put a false entry in the delay log)
// and "dormant" (a parked enquiry that will never revive should be closable).
// Still not allowed once the shoot is "completed" — at that point it happened.
const LOST_ALLOWED_FROM = new Set<EnquiryStatus>([
  "new",
  "contacted",
  "qualified",
  "shortlist_sent",
  "negotiating",
  "confirmed",
  "scheduled",
  "delayed",
  "dormant",
]);

function isAllowedTransition(from: EnquiryStatus, to: EnquiryStatus): boolean {
  if (to === "lost") return LOST_ALLOWED_FROM.has(from);
  if (to === "dormant") return !TERMINAL_STATUSES.has(from) && from !== "dormant";
  if (from === "dormant") return to === "contacted";
  if (to === "delayed") return from === "scheduled";
  if (from === "delayed") return to === "scheduled";

  const fromIdx = MAIN_SEQUENCE.indexOf(from);
  const toIdx = MAIN_SEQUENCE.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  if (EARLY.has(from) && EARLY.has(to)) return true; // move freely while nothing is booked
  if (toIdx < fromIdx) return true; // going back is always fine
  // Forward: one step at a time — except straight to "confirmed" from the early funnel.
  // Every step from Confirmed on needs real data (booking, date, feedback), checked below.
  return toIdx === fromIdx + 1 || (EARLY.has(from) && to === "confirmed");
}

function runGuard(to: EnquiryStatus, enquiry: EnquiryStateInput, payload: StatusChangeInput): void {
  switch (to) {
    case "confirmed": {
      const picked = enquiry.shortlist.filter((s) => s.outcome === "picked");
      if (picked.length !== 1) {
        throw new TransitionError("Pick exactly one studio in the shortlist before confirming.");
      }
      if (!enquiry.booking.platformBookingId && !enquiry.booking.offPlatform) {
        throw new TransitionError("Add the booking details (or mark it as closed off-platform) before confirming.");
      }
      break;
    }
    case "scheduled": {
      const shootDate = payload.currentShootDate ?? enquiry.schedule.currentShootDate;
      if (!shootDate) {
        throw new TransitionError("Add the shoot date first.");
      }
      break;
    }
    case "completed": {
      const shootDate = enquiry.schedule.currentShootDate;
      if (!shootDate || shootDate.getTime() > Date.now()) {
        throw new TransitionError("The shoot date hasn't passed yet, so this can't be completed.");
      }
      break;
    }
    case "closed_won": {
      const collectedAt = enquiry.feedback?.client?.collectedAt;
      if (!collectedAt && !payload.feedbackWaived) {
        throw new TransitionError("Save the client's feedback first, or skip it with a reason.");
      }
      if (payload.feedbackWaived && !payload.feedbackWaivedNote) {
        throw new TransitionError("Say why the feedback is being skipped.");
      }
      break;
    }
    case "lost": {
      if (!payload.lossReason) {
        throw new TransitionError("Choose why this enquiry was lost.");
      }
      break;
    }
    case "dormant": {
      if (!payload.nextActionDate) {
        throw new TransitionError("Set a date to revisit this enquiry.");
      }
      // Change Brief v1.1 §B: a date with no reason is a date with no context.
      if ((payload.nextActionReason?.trim().length ?? 0) < 8) {
        throw new TransitionError("Say why it's parked (at least 8 characters).");
      }
      break;
    }
    case "delayed": {
      if (!enquiry.schedule.delayEvents || enquiry.schedule.delayEvents.length === 0) {
        throw new TransitionError("Log the delay in the Delay log — that marks the shoot as delayed.");
      }
      break;
    }
    default:
      break;
  }
}

export function assertValidTransition(
  enquiry: EnquiryStateInput,
  to: string,
  payload: StatusChangeInput
): TransitionResult {
  if (!(ENQUIRY_STATUSES as readonly string[]).includes(to)) {
    throw new TransitionError(`Unknown status: ${to}`);
  }
  const target = to as EnquiryStatus;
  const from = enquiry.status;

  if (from === target) {
    throw new TransitionError("It already has that status.");
  }
  if (TERMINAL_STATUSES.has(from)) {
    throw new TransitionError("This enquiry is closed, so its status can no longer change.");
  }
  if (!isAllowedTransition(from, target)) {
    throw new TransitionError(`An enquiry can't go from ${from.replace(/_/g, " ")} to ${target.replace(/_/g, " ")} directly.`);
  }

  runGuard(target, enquiry, payload);

  const set: Record<string, unknown> = { status: target };

  if (target === "lost") {
    set["outcome.result"] = "lost";
    set["outcome.lossReason"] = payload.lossReason;
    set["outcome.lossNote"] = payload.lossNote ?? null;
    set["outcome.competitorName"] = payload.competitorName ?? null;
    set["outcome.closedAt"] = new Date();
  } else if (target === "closed_won") {
    set["outcome.result"] = "won";
    set["outcome.closedAt"] = new Date();
    if (payload.feedbackWaived) {
      set["feedbackWaived"] = true;
      set["feedbackWaivedNote"] = payload.feedbackWaivedNote ?? null;
    }
  } else if (target === "dormant") {
    set["outcome.result"] = "dormant";
    set["nextActionDate"] = payload.nextActionDate;
    set["nextActionReason"] = payload.nextActionReason;
  } else if (target === "contacted" && from === "dormant") {
    set["outcome.result"] = null;
  } else if (target === "scheduled" && payload.currentShootDate) {
    set["schedule.currentShootDate"] = payload.currentShootDate;
  }

  return { set };
}

/**
 * Statuses an enquiry may move to from `from`, per the transition graph
 * alone. Guards (a picked studio, a booking, a shoot date...) are still
 * enforced by assertValidTransition(); this only stops the UI offering moves
 * that can never succeed. Client-safe: no server-only imports.
 */
export function allowedNextStatuses(from: EnquiryStatus): EnquiryStatus[] {
  if (TERMINAL_STATUSES.has(from)) return [];
  return ENQUIRY_STATUSES.filter((to) => to !== from && isAllowedTransition(from, to));
}
