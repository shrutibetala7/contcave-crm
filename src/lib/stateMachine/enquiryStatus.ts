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

// §4.1 allows "lost" up to and including confirmed, and from delayed. It also
// allows it from "scheduled" here (a decision beyond the spec): a client can
// cancel a booked shoot before it happens, and forcing that through a fake
// delay would put a false entry in the delay log. Still not allowed once the
// shoot is "completed" — at that point it happened.
const LOST_ALLOWED_FROM = new Set<EnquiryStatus>([
  "new",
  "contacted",
  "qualified",
  "shortlist_sent",
  "negotiating",
  "confirmed",
  "scheduled",
  "delayed",
]);

function isAllowedTransition(from: EnquiryStatus, to: EnquiryStatus): boolean {
  if (to === "lost") return LOST_ALLOWED_FROM.has(from);
  if (to === "dormant") return !TERMINAL_STATUSES.has(from) && from !== "dormant";
  if (from === "dormant") return to === "contacted";
  if (to === "delayed") return from === "scheduled";
  // to === "lost" from "delayed" is already covered by LOST_ALLOWED_FROM above.
  if (from === "delayed") return to === "scheduled";

  const fromIdx = MAIN_SEQUENCE.indexOf(from);
  const toIdx = MAIN_SEQUENCE.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1 || toIdx === fromIdx - 1;
}

function isBackwardStep(from: EnquiryStatus, to: EnquiryStatus): boolean {
  const fromIdx = MAIN_SEQUENCE.indexOf(from);
  const toIdx = MAIN_SEQUENCE.indexOf(to);
  return fromIdx !== -1 && toIdx !== -1 && toIdx === fromIdx - 1;
}

function runGuard(to: EnquiryStatus, enquiry: EnquiryStateInput, payload: StatusChangeInput): void {
  switch (to) {
    case "confirmed": {
      const picked = enquiry.shortlist.filter((s) => s.outcome === "picked");
      if (picked.length !== 1) {
        throw new TransitionError(
          "confirmed requires exactly one shortlist entry with outcome 'picked'"
        );
      }
      if (!enquiry.booking.platformBookingId && !enquiry.booking.offPlatform) {
        throw new TransitionError(
          "confirmed requires booking.platformBookingId or booking.offPlatform"
        );
      }
      break;
    }
    case "scheduled": {
      const shootDate = payload.currentShootDate ?? enquiry.schedule.currentShootDate;
      if (!shootDate) {
        throw new TransitionError("scheduled requires schedule.currentShootDate");
      }
      break;
    }
    case "completed": {
      const shootDate = enquiry.schedule.currentShootDate;
      if (!shootDate || shootDate.getTime() > Date.now()) {
        throw new TransitionError("completed requires schedule.currentShootDate to be in the past");
      }
      break;
    }
    case "closed_won": {
      const collectedAt = enquiry.feedback?.client?.collectedAt;
      if (!collectedAt && !payload.feedbackWaived) {
        throw new TransitionError(
          "closed_won requires feedback.client.collectedAt, or feedbackWaived: true with a note"
        );
      }
      if (payload.feedbackWaived && !payload.feedbackWaivedNote) {
        throw new TransitionError("feedbackWaived requires feedbackWaivedNote");
      }
      break;
    }
    case "lost": {
      if (!payload.lossReason) {
        throw new TransitionError("lost requires lossReason");
      }
      break;
    }
    case "dormant": {
      if (!payload.nextActionDate) {
        throw new TransitionError("dormant requires nextActionDate (a revival date)");
      }
      // Change Brief v1.1 §B: a date with no reason is a date with no context.
      if ((payload.nextActionReason?.trim().length ?? 0) < 8) {
        throw new TransitionError("dormant requires nextActionReason (min 8 characters)");
      }
      break;
    }
    case "delayed": {
      if (!enquiry.schedule.delayEvents || enquiry.schedule.delayEvents.length === 0) {
        throw new TransitionError(
          "delayed requires a delay event — POST /api/enquiries/:id/delays first"
        );
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
    throw new TransitionError(`Enquiry is already ${target}`);
  }
  if (TERMINAL_STATUSES.has(from)) {
    throw new TransitionError(`Cannot transition out of terminal status ${from}`);
  }
  if (!isAllowedTransition(from, target)) {
    throw new TransitionError(`Cannot move enquiry from ${from} to ${target}`);
  }
  if (isBackwardStep(from, target) && !payload.note) {
    throw new TransitionError("A note is required when moving a status backward");
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

/** The single "keep going" step from `from`, if there is one. */
export function forwardStatus(from: EnquiryStatus): EnquiryStatus | null {
  if (from === "dormant") return "contacted";
  if (from === "delayed") return "scheduled";
  const idx = MAIN_SEQUENCE.indexOf(from);
  return idx >= 0 && idx < MAIN_SEQUENCE.length - 1 ? MAIN_SEQUENCE[idx + 1] : null;
}
