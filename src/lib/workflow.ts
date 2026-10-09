import {
  NOT_GOING_AHEAD_LABELS,
  isOpenStatus,
  type ActivityType,
  type EnquiryStatus,
  type FollowUpKind,
  type LossReason,
} from "@/lib/enums";
import { dayKey, formatShortDay, formatWeekday } from "@/lib/businessDay";
import { formatINR } from "@/lib/money";
import { TransitionError } from "@/lib/stateMachine/errors";
import type { Booking, Brief, FollowUp, LogUpdateInput, OverrideStageInput, ShortlistEntryDoc } from "@/lib/validation/enquiry";
import type { WorkflowSettings } from "@/lib/validation/settings";

/**
 * The lead workflow, as pure functions. Ops record what happened; each
 * function here works out what that means — the stage, the next follow-up,
 * the auto note — and returns it as a Plan, which lib/enquiryActions.ts
 * applies in one write alongside its activity row. Nothing else changes an
 * enquiry's stage or follow-up.
 *
 * Three rules hold everywhere:
 *  1. Stage is never edited directly — it moves because of an action here.
 *  2. An open enquiry always has exactly one follow-up; closing clears it.
 *  3. Every action writes one activity, so the timeline is the history.
 *
 * Client-safe (no server imports): the Log update sheet runs the same
 * planner to preview a save ("Save · next follow-up Thu 9 Oct").
 */

export interface WorkflowEnquiry {
  status: EnquiryStatus;
  shortlist: Pick<ShortlistEntryDoc, "id" | "studioId" | "studioName" | "outcome" | "quotedAmount" | "sentAt">[];
  booking: Booking;
  brief: Pick<Brief, "preferredDates">;
  followUp?: FollowUp | null;
  noReplyCount?: number | null;
  noReplyStartedAt?: Date | string | null;
  firstResponseAt?: Date | string | null;
  /** The contact has a phone or an Instagram handle — someone can actually be talked to. */
  reachable: boolean;
}

/** What the Log update sheet needs about a lead — enough to preview a save exactly. Serializable. */
export interface LogTarget {
  id: string;
  title: string;
  status: EnquiryStatus;
  noReplyCount: number;
  noReplyStartedAt: string | null;
  firstResponseAt: string | null;
  reachable: boolean;
  preferredDates: string[];
}

export interface Plan {
  /** $set patch — dotted paths allowed. */
  set: Record<string, unknown>;
  /** $push patch, for appending to arrays (delay events). Not undoable. */
  push?: Record<string, unknown>;
  activity: {
    type: ActivityType;
    /** The auto note — shown grey in the timeline. */
    body: string;
    /** What ops typed, if anything. */
    note?: string | null;
    meta?: Record<string, unknown>;
  };
  /** The status after this plan, for side effects and the client preview. */
  status: EnquiryStatus;
  followUp: FollowUp | null;
}

export interface Ctx {
  now: Date;
  userId: string;
}

const DAY = 86_400_000;

/** UTC midnight of the India calendar day `days` after `from` — how every all-day date is stored. */
export function dayAt(from: Date | string, days = 0): Date {
  const base = Date.parse(`${dayKey(from)}T00:00:00.000Z`);
  return new Date(base + days * DAY);
}

function followUp(kind: FollowUpKind, label: string, dueAt: Date, allDay: boolean, ctx: Ctx): FollowUp {
  return { kind, label, dueAt, allDay, createdAt: ctx.now, createdBy: ctx.userId };
}

/** "Thu 9 Oct" — how the save button and auto notes name a date. */
export function describeDay(date: Date | string): string {
  return `${formatWeekday(date)} ${formatShortDay(date)}`;
}

function shootDays(e: Pick<WorkflowEnquiry, "brief">): Date[] {
  return [...(e.brief.preferredDates ?? [])].map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
}

function requireOpen(e: WorkflowEnquiry) {
  if (!isOpenStatus(e.status)) throw new TransitionError("This enquiry is closed. Revive it, or ask an admin to override the stage.");
}

/** Leaving New means someone is talking to them — which needs a way to reach them. */
function leaveNew(e: WorkflowEnquiry, to: EnquiryStatus): EnquiryStatus {
  if (e.status !== "new") return e.status;
  if (!e.reachable) throw new TransitionError("Add their phone number or Instagram first — there's no way to reach them yet.");
  return to;
}

/** Fields every logged action on a New lead stamps: we've responded. */
function firstResponse(e: WorkflowEnquiry, ctx: Ctx): Record<string, unknown> {
  return e.firstResponseAt ? {} : { firstResponseAt: ctx.now };
}

const RESET_NO_REPLY = { noReplyCount: 0, noReplyStartedAt: null };

/** The follow-up a confirmed booking carries: confirm timings the day before the shoot. */
export function confirmTimingsFollowUp(dates: Date[], ctx: Ctx): FollowUp {
  const first = dates[0];
  const due = first ? dayAt(first, -1) : dayAt(ctx.now);
  const today = dayAt(ctx.now);
  return followUp("confirm_timings", "Confirm timings with studio and client", due < today ? today : due, true, ctx);
}

// ---- Log update ------------------------------------------------------------------------

export function planLogUpdate(e: WorkflowEnquiry, input: LogUpdateInput, settings: WorkflowSettings, ctx: Ctx): Plan {
  requireOpen(e);
  const note = input.note?.trim() || null;
  const today = dayAt(ctx.now);

  switch (input.outcome) {
    case "no_reply": {
      const count = (e.noReplyCount ?? 0) + 1;
      const startedAt = e.noReplyCount && e.noReplyStartedAt ? new Date(e.noReplyStartedAt) : ctx.now;
      const meta = { outcome: input.outcome, noReplyCount: count };
      if (count >= settings.parkAfter) {
        return {
          status: "parked",
          followUp: null,
          set: {
            ...firstResponse(e, ctx),
            status: "parked",
            followUp: null,
            noReplyCount: count,
            noReplyStartedAt: startedAt,
            "outcome.result": "dormant",
            "outcome.lossReason": "no_response" satisfies LossReason,
            "outcome.lossNote": note,
            "outcome.closedAt": ctx.now,
          },
          activity: { type: "outcome", body: `No reply (${count} of ${settings.parkAfter}) — parked as ghosted`, note, meta },
        };
      }
      const offset = settings.cadenceDays[Math.min(count - 1, settings.cadenceDays.length - 1)];
      let due = dayAt(startedAt, offset);
      if (due <= today) due = dayAt(ctx.now, 1); // logged late — chase tomorrow, never in the past
      const next = followUp("chase", `Chase again — no reply ${count} of ${settings.parkAfter}`, due, true, ctx);
      return {
        status: e.status,
        followUp: next,
        set: { ...firstResponse(e, ctx), followUp: next, noReplyCount: count, noReplyStartedAt: startedAt },
        activity: { type: "outcome", body: `No reply (${count} of ${settings.parkAfter})`, note, meta },
      };
    }

    case "replied": {
      const due = dayAt(input.followUpOn);
      if (due < today) throw new TransitionError("Pick today or a later date.");
      const status = leaveNew(e, "talking");
      const next = followUp("chase", note ?? "Follow up — they're still deciding", due, true, ctx);
      return {
        status,
        followUp: next,
        set: { ...firstResponse(e, ctx), ...RESET_NO_REPLY, status, followUp: next },
        activity: { type: "outcome", body: `Replied, follow up ${describeDay(due)}`, note, meta: { outcome: input.outcome } },
      };
    }

    case "postponed": {
      const newFirst = dayAt(input.shootDate);
      if (newFirst < today) throw new TransitionError("The new shoot date can't be in the past.");
      const status = leaveNew(e, "talking");
      // Keep a multi-day shoot's length: shift every day by the same amount.
      const old = shootDays(e);
      const shift = old.length ? newFirst.getTime() - dayAt(old[0]).getTime() : 0;
      const dates = old.length ? old.map((d) => new Date(dayAt(d).getTime() + shift)) : [newFirst];
      const fiveBefore = dayAt(newFirst, -5);
      const due = fiveBefore > today ? fiveBefore : dayAt(ctx.now, 1);
      const next = followUp("chase", "Check the postponed shoot is still on", due, true, ctx);
      const plan: Plan = {
        status,
        followUp: next,
        set: { ...firstResponse(e, ctx), ...RESET_NO_REPLY, status, followUp: next, "brief.preferredDates": dates, "brief.datesFlexible": false },
        activity: { type: "outcome", body: `Postponed to ${describeDay(newFirst)}`, note, meta: { outcome: input.outcome, shootDate: newFirst } },
      };
      // A booked shoot moving is a delay worth keeping on the record.
      if (e.status === "confirmed" && old.length) {
        plan.push = {
          "schedule.delayEvents": {
            id: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
            previousDate: old[0],
            newDate: newFirst,
            estimatedWindow: null,
            reason: note ?? "Client postponed the shoot",
            causedBy: "client",
            reportedAt: ctx.now,
            followUpOn: null,
            followUpReason: null,
            resolved: true,
            note: null,
          },
        };
      }
      return plan;
    }

    case "not_going_ahead": {
      const label = NOT_GOING_AHEAD_LABELS[input.reason];
      const closing = { ...firstResponse(e, ctx), ...RESET_NO_REPLY, followUp: null, "outcome.closedAt": ctx.now };
      if (input.reason === "shoot_cancelled") {
        return {
          status: "cancelled",
          followUp: null,
          set: { ...closing, status: "cancelled", "outcome.result": "cancelled", "outcome.cancelReason": "shoot_cancelled", "outcome.cancelNote": note },
          activity: { type: "outcome", body: `Cancelled: ${label.toLowerCase()}`, note, meta: { outcome: input.outcome, reason: input.reason } },
        };
      }
      return {
        status: "lost",
        followUp: null,
        set: { ...closing, status: "lost", "outcome.result": "lost", "outcome.lossReason": input.reason satisfies LossReason, "outcome.lossNote": note },
        activity: { type: "outcome", body: `Lost: ${label}`, note, meta: { outcome: input.outcome, reason: input.reason } },
      };
    }
  }
}

// ---- options sent ------------------------------------------------------------------------

/** Options went out to the client — `sent` are the offers in this message. */
export function planOptionsSent(
  e: WorkflowEnquiry,
  sent: { studioName: string }[],
  settings: WorkflowSettings,
  ctx: Ctx,
  note?: string | null
): Plan {
  requireOpen(e);
  if (e.status === "confirmed") throw new TransitionError("This one is already booked.");
  if (e.shortlist.length === 0) throw new TransitionError("Add at least one studio before sending options.");
  leaveNew(e, "options_sent"); // checks a New lead can be reached
  const status: EnquiryStatus = "options_sent";
  const due = new Date(ctx.now.getTime() + settings.optionsFollowupHours * 3_600_000);
  const next = followUp("options_check", "Check which studio they like", due, false, ctx);
  const names = (sent.length ? sent : e.shortlist).map((s) => s.studioName);
  return {
    status,
    followUp: next,
    set: { ...firstResponse(e, ctx), ...RESET_NO_REPLY, status, followUp: next },
    activity: {
      type: "offer_sent",
      body: `Sent ${names.length} option${names.length === 1 ? "" : "s"}: ${names.join(", ")}`,
      note: note?.trim() || null,
      meta: { studios: names },
    },
  };
}

// ---- booking ------------------------------------------------------------------------------

export function planBooking(
  e: WorkflowEnquiry,
  input: { chosenId: string; grossValue: number; platformBookingId: string | null; shootDates: Date[] },
  ctx: Ctx
): Plan {
  const chosen = e.shortlist.find((s) => s.id === input.chosenId);
  if (!chosen) throw new TransitionError("That studio isn't on this enquiry's shortlist any more.");
  const alreadyBooked = e.status === "confirmed" || e.status === "done";
  if (!alreadyBooked) requireOpen(e);
  if (!input.shootDates.length) throw new TransitionError("Add the shoot date.");

  const shortlist = e.shortlist.map((s) =>
    s.id === chosen.id ? { ...s, outcome: "picked" as const } : s.outcome === "picked" ? { ...s, outcome: "pending" as const } : s
  );
  const booking = {
    ...e.booking,
    studioId: chosen.studioId,
    grossValue: input.grossValue,
    platformBookingId: input.platformBookingId,
    offPlatform: !input.platformBookingId,
  };
  const dates = [...input.shootDates].map((d) => dayAt(d)).sort((a, b) => a.getTime() - b.getTime());
  const status: EnquiryStatus = e.status === "done" ? "done" : "confirmed";
  // A Done booking keeps whatever post-shoot task it has; a Confirmed one re-aims at the (maybe new) date.
  const next = status === "confirmed" ? confirmTimingsFollowUp(dates, ctx) : e.followUp ?? null;

  const set: Record<string, unknown> = {
    shortlist,
    booking,
    "brief.preferredDates": dates,
    "brief.datesFlexible": false,
    status,
    followUp: next,
    ...RESET_NO_REPLY,
  };
  if (!alreadyBooked) {
    Object.assign(set, firstResponse(e, ctx), { "outcome.result": "won", "outcome.closedAt": ctx.now });
  }
  const when = dates.length > 1 ? `${formatShortDay(dates[0])} – ${formatShortDay(dates[dates.length - 1])}` : formatShortDay(dates[0]);
  return {
    status,
    followUp: next,
    set,
    activity: {
      type: "booking",
      body: `${alreadyBooked ? "Booking updated" : "Booked"}: ${chosen.studioName}, ${when}, ${formatINR(input.grossValue)}${input.platformBookingId ? "" : " (off-platform)"}`,
      meta: { studioId: chosen.studioId, from: e.status, to: status },
    },
  };
}

// ---- the calendar: shoot happened -----------------------------------------------------------

export function planShootDone(e: WorkflowEnquiry, ctx: Ctx): Plan {
  if (e.status !== "confirmed") throw new TransitionError("Only a confirmed booking can be marked done.");
  const next = followUp("send_feedback", "Send the feedback link", dayAt(ctx.now), true, ctx);
  return {
    status: "done",
    followUp: next,
    set: { status: "done", followUp: next },
    activity: { type: "status_change", body: "Shoot date has passed — marked done automatically.", meta: { from: "confirmed", to: "done" } },
  };
}

// ---- follow-up housekeeping -------------------------------------------------------------------

/**
 * Tick off a follow-up that isn't a conversation with the lead — the
 * confirm-timings call before a shoot, and the post-shoot tasks. (Chasing a
 * lead is completed by logging what happened instead.) Each hands on to the
 * next task in the chain, so there's still only ever one.
 */
export function planFollowUpDone(e: WorkflowEnquiry, ctx: Ctx): Plan {
  const current = e.followUp;
  if (!current) throw new TransitionError("There's no follow-up to complete.");
  const days = shootDays(e);
  let next: FollowUp | null = null;
  const set: Record<string, unknown> = {};

  switch (current.kind) {
    case "confirm_timings": {
      const last = days[days.length - 1];
      next = followUp("chase", "Shoot day — check it's going ahead", last && dayAt(last) > dayAt(ctx.now) ? dayAt(last) : dayAt(ctx.now), true, ctx);
      break;
    }
    case "send_feedback": {
      // Off-platform, we only get paid if we chase it.
      if (!e.booking.platformBookingId && !e.booking.commissionReceivedAt) {
        const last = days[days.length - 1] ?? ctx.now;
        const due = dayAt(last, 8); // a week after the morning after the shoot
        next = followUp("collect_commission", "Collect commission from the studio", due < dayAt(ctx.now) ? dayAt(ctx.now) : due, true, ctx);
      }
      break;
    }
    case "collect_commission": {
      if (!e.booking.commissionReceivedAt) set["booking.commissionReceivedAt"] = dayAt(ctx.now);
      if (!e.booking.commissionInvoicedAt) set["booking.commissionInvoicedAt"] = dayAt(ctx.now);
      break;
    }
    default:
      throw new TransitionError("Log what happened instead — that sets the next follow-up.");
  }
  set.followUp = next;
  return {
    status: e.status,
    followUp: next,
    set,
    activity: { type: "followup", body: `Done: ${current.label}`, meta: { kind: current.kind } },
  };
}

export function planReschedule(e: WorkflowEnquiry, dueOn: Date, label: string | undefined, ctx: Ctx): Plan {
  if (!e.followUp) throw new TransitionError("There's no follow-up to move.");
  const due = dayAt(dueOn);
  if (due < dayAt(ctx.now)) throw new TransitionError("Pick today or a later date.");
  const next: FollowUp = { ...e.followUp, label: label ?? e.followUp.label, dueAt: due, allDay: true };
  return {
    status: e.status,
    followUp: next,
    set: { followUp: next },
    activity: { type: "followup", body: `Follow-up moved to ${describeDay(due)}`, meta: { kind: next.kind } },
  };
}

// ---- revive / override --------------------------------------------------------------------------

/** A parked lead messaged again: back to Talking, with a date to follow up. */
export function planRevive(e: WorkflowEnquiry, followUpOn: Date, ctx: Ctx, note?: string | null): Plan {
  if (e.status !== "parked") throw new TransitionError("Only a parked lead can be revived.");
  const due = dayAt(followUpOn);
  if (due < dayAt(ctx.now)) throw new TransitionError("Pick today or a later date.");
  const next = followUp("chase", note?.trim() || "Follow up — they're back in touch", due, true, ctx);
  return {
    status: "talking",
    followUp: next,
    set: {
      status: "talking",
      followUp: next,
      ...RESET_NO_REPLY,
      "outcome.result": null,
      "outcome.lossReason": null,
      "outcome.lossNote": null,
      "outcome.closedAt": null,
    },
    activity: { type: "outcome", body: `Revived — follow up ${describeDay(due)}`, note: note?.trim() || null, meta: { from: "parked", to: "talking" } },
  };
}

/** Admin only, and always on the record: put an enquiry in a stage directly. */
export function planOverride(e: WorkflowEnquiry, input: OverrideStageInput, ctx: Ctx): Plan {
  if (input.to === e.status) throw new TransitionError("It's already at that stage.");
  const open = isOpenStatus(input.to);
  const next = open ? followUp("chase", "Follow up (stage set by an admin)", dayAt(input.followUpOn!), true, ctx) : null;
  const set: Record<string, unknown> = { status: input.to, followUp: next, ...RESET_NO_REPLY };
  switch (input.to) {
    case "confirmed":
    case "done":
      Object.assign(set, { "outcome.result": "won", "outcome.closedAt": ctx.now });
      break;
    case "lost":
    case "parked":
      Object.assign(set, {
        "outcome.result": input.to === "lost" ? "lost" : "dormant",
        "outcome.lossReason": input.lossReason,
        "outcome.closedAt": ctx.now,
      });
      break;
    case "cancelled":
      Object.assign(set, { "outcome.result": "cancelled", "outcome.cancelReason": input.cancelReason, "outcome.closedAt": ctx.now });
      break;
    default:
      Object.assign(set, { "outcome.result": null, "outcome.closedAt": null });
  }
  return {
    status: input.to,
    followUp: next,
    set,
    activity: {
      type: "stage_override",
      body: `Stage set to ${input.to.replace(/_/g, " ")} by an admin`,
      note: input.reason,
      meta: { from: e.status, to: input.to },
    },
  };
}

/** The save button's promise: what the follow-up will be after this plan. */
export function describeOutcomeResult(plan: Pick<Plan, "status" | "followUp">): string {
  if (plan.followUp) {
    const f = plan.followUp;
    return f.allDay
      ? `next follow-up ${describeDay(f.dueAt)}`
      : `next follow-up ${describeDay(f.dueAt)}, ${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(f.dueAt)}`;
  }
  if (plan.status === "parked") return "parks it as ghosted";
  if (plan.status === "lost") return "closes it as lost";
  if (plan.status === "cancelled") return "closes it as cancelled";
  return "no follow-up";
}
