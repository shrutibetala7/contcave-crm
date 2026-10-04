import { ENQUIRY_STATUSES, LOSS_REASON_LABELS, type EnquiryStatus } from "@/lib/enums";
import { TransitionError } from "@/lib/stateMachine/errors";
import type { Booking, Brief, Feedback, Schedule, ShortlistEntryDoc, StatusChangeInput } from "@/lib/validation/enquiry";

/**
 * The enquiry pipeline is eight statuses (see lib/enums.ts): New Lead, In
 * Progress, Confirmed, Completed, On Hold, Cancelled, Lost, Dormant. Any
 * non-terminal status can move to any other — there is no forced order —
 * except the three dead ends (Completed, Cancelled, Lost) and Confirmed,
 * which only exits to Completed (the shoot happened) or sideways to On Hold
 * or Cancelled (a booked shoot can still fall through). Completed is only
 * reachable from Confirmed, so a completed shoot always had a booking. This
 * module is the *only* place that decides — API routes call
 * assertValidTransition() and apply the returned `set` patch; they never
 * branch on status themselves.
 */

export interface EnquiryStateInput {
  status: EnquiryStatus;
  shortlist: ShortlistEntryDoc[];
  booking: Booking;
  schedule: Schedule;
  feedback: Feedback;
  brief?: Pick<Brief, "preferredDates">;
  firstResponseAt?: Date | null;
}

export interface TransitionResult {
  set: Record<string, unknown>;
}

const TERMINAL_STATUSES = new Set<EnquiryStatus>(["completed", "cancelled", "lost"]);

function isAllowedTransition(from: EnquiryStatus, to: EnquiryStatus): boolean {
  if (TERMINAL_STATUSES.has(from)) return false;
  if (to === "completed") return from === "confirmed";
  if (from === "confirmed") return to === "on_hold" || to === "cancelled";
  return true; // every other non-terminal status can move to any other status
}

function runGuard(to: EnquiryStatus, enquiry: EnquiryStateInput, payload: StatusChangeInput): void {
  switch (to) {
    case "confirmed": {
      // One step in the UI (Book on the chosen studio) fills in all three of these.
      const picked = enquiry.shortlist.filter((s) => s.outcome === "picked");
      if (picked.length !== 1 || (!enquiry.booking.platformBookingId && !enquiry.booking.offPlatform)) {
        throw new TransitionError("Book a studio first — on the enquiry, click Book next to the studio they chose.");
      }
      // Without a shoot date it could never move on to Completed by itself.
      if (!enquiry.brief?.preferredDates?.length) {
        throw new TransitionError("Add the shoot date before confirming.");
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
      // Parking is how dead leads used to dodge Lost — so it asks the same
      // question, from the same list, and the answer lands in the numbers.
      if (!payload.lossReason) {
        throw new TransitionError("Choose why it's being parked.");
      }
      if (!payload.nextActionDate) {
        throw new TransitionError("Set a date to revisit this enquiry.");
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
        : target === "completed"
        ? "Only a confirmed booking can be marked completed."
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
    set["outcome.lossReason"] = payload.lossReason;
    set["outcome.lossNote"] = payload.lossNote ?? null;
    set["nextActionDate"] = payload.nextActionDate;
    // The structured reason carries the "why"; the note is optional extra context.
    const note = payload.nextActionReason?.trim() ?? "";
    set["nextActionReason"] =
      note.length >= 8 ? note : `Revisit — parked: ${LOSS_REASON_LABELS[payload.lossReason!].toLowerCase()}`;
  } else if (from === "dormant") {
    set["outcome.result"] = null; // revived
    set["outcome.lossReason"] = null;
    set["outcome.lossNote"] = null;
  }

  // Leaving New Lead means someone replied — the response-time clock stops.
  if (from === "new_lead" && !enquiry.firstResponseAt) {
    set["firstResponseAt"] = new Date();
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
