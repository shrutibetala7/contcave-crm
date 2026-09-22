import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/lib/enums";
import { TransitionError } from "@/lib/stateMachine/errors";
import type { Booking, Feedback, Schedule, ShortlistEntryDoc, StatusChangeInput } from "@/lib/validation/enquiry";

/**
 * The enquiry pipeline is seven statuses (see lib/enums.ts): New Lead, In
 * Progress, Confirmed, On Hold, Cancelled, Lost, Dormant. Any non-terminal
 * status can move to any other — there is no forced order — except the two
 * dead ends (Cancelled, Lost) and Confirmed, which only exits sideways to
 * On Hold or Cancelled (a booked shoot can still fall through). This module
 * is the *only* place that decides — API routes call assertValidTransition()
 * and apply the returned `set` patch; they never branch on status themselves.
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

const TERMINAL_STATUSES = new Set<EnquiryStatus>(["cancelled", "lost"]);

function isAllowedTransition(from: EnquiryStatus, to: EnquiryStatus): boolean {
  if (TERMINAL_STATUSES.has(from)) return false;
  if (from === "confirmed") return to === "on_hold" || to === "cancelled";
  return true; // every other non-terminal status can move to any other status
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
    case "cancelled": {
      if (!payload.cancelReason) {
        throw new TransitionError("Choose why this was cancelled.");
      }
      if (payload.cancelReason === "other" && !(payload.cancelNote?.trim().length ?? 0)) {
        throw new TransitionError("Say what the reason was.");
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
  if (!isAllowedTransition(from, target)) {
    throw new TransitionError(
      TERMINAL_STATUSES.has(from)
        ? "This enquiry is closed, so its status can no longer change."
        : `An enquiry can't go from ${from.replace(/_/g, " ")} to ${target.replace(/_/g, " ")} directly.`
    );
  }

  runGuard(target, enquiry, payload);

  const set: Record<string, unknown> = { status: target };

  if (target === "confirmed") {
    // Confirmed replaces the old "closed_won" — the deal is done, the lead becomes a customer.
    set["outcome.result"] = "won";
    set["outcome.closedAt"] = new Date();
  } else if (target === "cancelled") {
    set["outcome.result"] = "cancelled";
    set["outcome.cancelReason"] = payload.cancelReason;
    set["outcome.cancelNote"] = payload.cancelNote ?? null;
    set["outcome.closedAt"] = new Date();
  } else if (target === "lost") {
    set["outcome.result"] = "lost";
    set["outcome.lossReason"] = payload.lossReason;
    set["outcome.lossNote"] = payload.lossNote ?? null;
    set["outcome.competitorName"] = payload.competitorName ?? null;
    set["outcome.closedAt"] = new Date();
  } else if (target === "dormant") {
    set["outcome.result"] = "dormant";
    set["nextActionDate"] = payload.nextActionDate;
    set["nextActionReason"] = payload.nextActionReason;
  } else if (from === "dormant") {
    set["outcome.result"] = null; // revived
  }

  return { set };
}

/**
 * Statuses an enquiry may move to from `from`, per the transition graph
 * alone. Guards (a picked studio, a booking, a reason...) are still
 * enforced by assertValidTransition(); this only stops the UI offering moves
 * that can never succeed. Client-safe: no server-only imports.
 */
export function allowedNextStatuses(from: EnquiryStatus): EnquiryStatus[] {
  if (TERMINAL_STATUSES.has(from)) return [];
  return ENQUIRY_STATUSES.filter((to) => to !== from && isAllowedTransition(from, to));
}
