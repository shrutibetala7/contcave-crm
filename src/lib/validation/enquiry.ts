import { z } from "zod";
import {
  BRAND_CATEGORIES,
  CANCEL_REASONS,
  DELAY_CAUSED_BY,
  ENQUIRY_SOURCES,
  ENQUIRY_STATUSES,
  FEEDBACK_ISSUES,
  FOLLOW_UP_KINDS,
  LOSS_REASONS,
  NOT_GOING_AHEAD_REASONS,
  SHOOT_TYPES,
  SHORTLIST_OUTCOMES,
} from "@/lib/enums";
import { objectIdString, optionalObjectIdString, patchOf } from "@/lib/validation/common";

// ---- brief ----------------------------------------------------------------

// Change Brief v1.1 §A: how each field entered the record. Keyed by dotted
// path (e.g. "brief.shootType", "contact.phone" — the latter lives on a
// separate contacts doc, but its provenance is still recorded here since
// that's what the quick-add parse produced). Absent on v1-era enquiries —
// treated as "stated" (a human typed it), never rendered as unconfirmed.
export const fieldEvidenceSchema = z.object({
  evidence: z.enum(["stated", "observed", "inferred"]),
  confirmedBy: z.string().nullable(),
  confirmedAt: z.coerce.date().nullable(),
});
export type FieldEvidence = z.infer<typeof fieldEvidenceSchema>;

export const briefSchema = z.object({
  // The customer's own words. Worth keeping (it's what the parser learns
  // from), but not worth losing a whole enquiry over when nobody wrote it down.
  rawText: z.string().default(""),
  shootType: z.enum(SHOOT_TYPES).nullable().optional(),
  deliverables: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  preferredLocality: z.string().nullable().optional(),
  preferredDates: z.array(z.coerce.date()).default([]),
  datesFlexible: z.boolean().default(false),
  durationHours: z.number().nullable().optional(),
  crewSize: z.number().nullable().optional(),
  budgetMin: z.number().nullable().optional(),
  budgetMax: z.number().nullable().optional(),
  requirements: z.array(z.string()).default([]),
  fieldEvidence: z.record(z.string(), fieldEvidenceSchema).default({}),
});
export type Brief = z.infer<typeof briefSchema>;

// ---- enquiry create --------------------------------------------------------

export const enquiryCreateSchema = z
  .object({
    brandId: optionalObjectIdString,
    contactId: optionalObjectIdString,
    // The brand's (or, with no named brand, the enquiry's own) line of
    // business — "Brand Name if available, else Industry".
    industry: z.enum(BRAND_CATEGORIES).nullable().optional(),
    source: z.enum(ENQUIRY_SOURCES),
    sourceDetail: z.string().nullable().optional(),
    brief: briefSchema,
    // When the enquiry actually came in — distinct from createdAt (when the
    // CRM record was made), so backfilled history can carry its real date.
    // Always sent by the UI (defaulting to today), so it's required here;
    // lenient on read (enquiryDocSchema) for any record from before this existed.
    enquiryDate: z.coerce.date(),
    ownerId: optionalObjectIdString,
  });
export type EnquiryCreateInput = z.infer<typeof enquiryCreateSchema>;

// ---- shortlist --------------------------------------------------------------

export const shortlistCreateSchema = z.object({
  studioId: objectIdString,
  quotedAmount: z.number().nullable().optional(),
});
export type ShortlistCreateInput = z.infer<typeof shortlistCreateSchema>;

export const shortlistUpdateSchema = z.object({
  outcome: z.enum(SHORTLIST_OUTCOMES).optional(),
  outcomeNote: z.string().nullable().optional(),
  quotedAmount: z.number().nullable().optional(),
  studioRespondedAt: z.coerce.date().nullable().optional(),
});
export type ShortlistUpdateInput = z.infer<typeof shortlistUpdateSchema>;

export const shortlistEntryDocSchema = shortlistCreateSchema.extend({
  id: z.string(),
  studioName: z.string(),
  sentAt: z.date(),
  studioRespondedAt: z.date().nullable().optional(),
  outcome: z.enum(SHORTLIST_OUTCOMES).default("pending"),
  outcomeNote: z.string().nullable().optional(),
});
export type ShortlistEntryDoc = z.infer<typeof shortlistEntryDocSchema>;

// ---- outcome / booking --------------------------------------------------------

export const outcomeSchema = z.object({
  result: z.enum(["won", "lost", "dormant", "cancelled"]).nullable().optional(),
  lossReason: z.enum(LOSS_REASONS).nullable().optional(),
  lossNote: z.string().nullable().optional(),
  competitorName: z.string().nullable().optional(),
  // Set when result is "cancelled" — a different reason set than Lost's,
  // since a cancellation is usually an operational reason, not a commercial one.
  cancelReason: z.enum(CANCEL_REASONS).nullable().optional(),
  cancelNote: z.string().nullable().optional(),
  closedAt: z.date().nullable().optional(),
});
export type Outcome = z.infer<typeof outcomeSchema>;

export const bookingSchema = z.object({
  platformBookingId: z.string().nullable().optional(),
  offPlatform: z.boolean().default(false),
  studioId: z.string().nullable().optional(),
  grossValue: z.number().nullable().optional(),
  commissionValue: z.number().nullable().optional(),
  currency: z.literal("INR").default("INR"),
  // Until these are set, commission is expected, not collected — and off-
  // platform bookings depend on the studio being honest about the shoot.
  commissionInvoicedAt: z.coerce.date().nullable().optional(),
  commissionReceivedAt: z.coerce.date().nullable().optional(),
});
export type Booking = z.infer<typeof bookingSchema>;

// ---- book a studio (one step: pick + booking + shoot date + confirm) ----------

export const bookStudioSchema = z.object({
  shortlistEntryId: z.string().min(1),
  grossValue: z.number().positive("Enter what the booking is worth"),
  // Empty = booked off-platform.
  platformBookingId: z.string().trim().nullable().optional(),
  // A single day, or the first and last day of a multi-day shoot.
  shootDates: z.array(z.coerce.date()).min(1, "Add the shoot date").max(2),
});
export type BookStudioInput = z.infer<typeof bookStudioSchema>;

// ---- enquiry update ---------------------------------------------------------

// Stage and follow-up are never edited here — they move only through the
// workflow actions (Log update, options sent, booking, revive, override;
// see lib/enquiryActions.ts). shortlist, delays and feedback have their own
// endpoints too. This is for the brief, owner and booking details.
export const enquiryUpdateSchema = z
  .object({
    brandId: optionalObjectIdString,
    contactId: optionalObjectIdString,
    industry: z.enum(BRAND_CATEGORIES).nullable().optional(),
    source: z.enum(ENQUIRY_SOURCES).optional(),
    sourceDetail: z.string().nullable().optional(),
    brief: patchOf(briefSchema).optional(),
    booking: patchOf(bookingSchema).optional(),
    enquiryDate: z.coerce.date().optional(),
    ownerId: optionalObjectIdString,
  });
export type EnquiryUpdateInput = z.infer<typeof enquiryUpdateSchema>;

// ---- delays -------------------------------------------------------------------

export const delayCreateSchema = z
  .object({
    previousDate: z.coerce.date(),
    newDate: z.coerce.date().nullable().optional(),
    estimatedWindow: z.string().nullable().optional(),
    reason: z.string().min(1),
    causedBy: z.enum(DELAY_CAUSED_BY),
    followUpOn: z.coerce.date().nullable().optional(),
    // Change Brief v1.1 §B: a recheck that can't say why it exists doesn't
    // have a reason — required alongside followUpOn.
    followUpReason: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .refine((d) => d.newDate != null || d.followUpOn != null, {
    message: "followUpOn is required when newDate is not set",
    path: ["followUpOn"],
  })
  .refine((d) => d.newDate != null || (d.followUpReason?.trim().length ?? 0) >= 8, {
    message: "followUpReason is required (min 8 characters) when newDate is not set",
    path: ["followUpReason"],
  });
export type DelayCreateInput = z.infer<typeof delayCreateSchema>;

export const delayUpdateSchema = z
  .object({
    newDate: z.coerce.date().nullable().optional(),
    followUpOn: z.coerce.date().nullable().optional(),
    followUpReason: z.string().nullable().optional(),
    resolved: z.boolean().optional(),
    note: z.string().nullable().optional(),
  })
  .refine((d) => d.resolved === true || d.newDate != null || d.followUpOn != null, {
    message: "followUpOn is required while newDate is not set and the delay is unresolved",
    path: ["followUpOn"],
  })
  .refine((d) => d.resolved === true || d.newDate != null || (d.followUpReason?.trim().length ?? 0) >= 8, {
    message: "followUpReason is required (min 8 characters) while newDate is not set and the delay is unresolved",
    path: ["followUpReason"],
  });
export type DelayUpdateInput = z.infer<typeof delayUpdateSchema>;

export const delayEventDocSchema = z.object({
  id: z.string(),
  previousDate: z.date(),
  newDate: z.date().nullable().optional(),
  estimatedWindow: z.string().nullable().optional(),
  reason: z.string(),
  causedBy: z.enum(DELAY_CAUSED_BY),
  reportedAt: z.date(),
  followUpOn: z.date().nullable().optional(),
  followUpReason: z.string().nullable().optional(),
  resolved: z.boolean().default(false),
  note: z.string().nullable().optional(),
});
export type DelayEventDoc = z.infer<typeof delayEventDocSchema>;

export const scheduleSchema = z.object({
  originalShootDate: z.date().nullable().optional(),
  currentShootDate: z.date().nullable().optional(),
  endDate: z.date().nullable().optional(),
  delayEvents: z.array(delayEventDocSchema).default([]),
});
export type Schedule = z.infer<typeof scheduleSchema>;

// ---- feedback -------------------------------------------------------------------

export const clientFeedbackInputSchema = z.object({
  overallRating: z.number().min(1).max(5),
  studioRating: z.number().min(1).max(5),
  platformRating: z.number().min(1).max(5),
  wouldRebook: z.boolean(),
  verbatim: z.string().nullable().optional(),
  issues: z.array(z.enum(FEEDBACK_ISSUES)).default([]),
  publishedAsReview: z.boolean().default(false),
  reviewUrl: z.string().nullable().optional(),
});

export const studioFeedbackInputSchema = z.object({
  clientRating: z.number().min(1).max(5),
  paymentOnTime: z.boolean(),
  damageReported: z.boolean(),
  verbatim: z.string().nullable().optional(),
});

export const feedbackCreateSchema = z.discriminatedUnion("side", [
  z.object({ side: z.literal("client") }).merge(clientFeedbackInputSchema),
  z.object({ side: z.literal("studio") }).merge(studioFeedbackInputSchema),
]);
export type FeedbackCreateInput = z.infer<typeof feedbackCreateSchema>;

export const feedbackSchema = z.object({
  client: clientFeedbackInputSchema
    .extend({ collectedAt: z.date(), collectedBy: z.string() })
    .nullable()
    .optional(),
  studio: studioFeedbackInputSchema
    .extend({ collectedAt: z.date(), collectedBy: z.string() })
    .nullable()
    .optional(),
});
export type Feedback = z.infer<typeof feedbackSchema>;

// ---- follow-up ---------------------------------------------------------------------

/**
 * The one open follow-up an open enquiry always has. `allDay` follow-ups are
 * due on a calendar day (stored as UTC midnight of that India date, like
 * every other date here) and only go overdue the day after; timed ones
 * (first reply, the check after sending options) go overdue at `dueAt`.
 */
export const followUpSchema = z.object({
  kind: z.enum(FOLLOW_UP_KINDS),
  label: z.string(),
  dueAt: z.coerce.date(),
  allDay: z.boolean(),
  createdAt: z.coerce.date(),
  createdBy: z.string(),
});
export type FollowUp = z.infer<typeof followUpSchema>;

// ---- workflow actions ------------------------------------------------------------------

const note = z.string().trim().max(500).nullable().optional();

/** Log update: one outcome, its one input, an optional note. */
export const logUpdateSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("no_reply"), note }),
  z.object({ outcome: z.literal("replied"), followUpOn: z.coerce.date(), note }),
  z.object({ outcome: z.literal("postponed"), shootDate: z.coerce.date(), note }),
  z.object({ outcome: z.literal("not_going_ahead"), reason: z.enum(NOT_GOING_AHEAD_REASONS), note }),
]);
export type LogUpdateInput = z.infer<typeof logUpdateSchema>;

export const optionsSentSchema = z.object({ note });
export const reviveSchema = z.object({ followUpOn: z.coerce.date(), note });
export const rescheduleFollowUpSchema = z.object({ dueOn: z.coerce.date(), label: z.string().trim().min(1).max(120).optional() });

/** Admin only: put an enquiry in a stage directly, with a reason on the record. */
export const overrideStageSchema = z
  .object({
    to: z.enum(ENQUIRY_STATUSES),
    reason: z.string().trim().min(3, "Say why (a few words)"),
    followUpOn: z.coerce.date().nullable().optional(),
    lossReason: z.enum(LOSS_REASONS).nullable().optional(),
    cancelReason: z.enum(CANCEL_REASONS).nullable().optional(),
  })
  .refine((d) => !["new", "talking", "options_sent", "confirmed"].includes(d.to) || d.followUpOn != null, {
    message: "An open stage needs a follow-up date",
    path: ["followUpOn"],
  })
  .refine((d) => (d.to !== "lost" && d.to !== "parked") || d.lossReason != null, {
    message: "Choose a reason",
    path: ["lossReason"],
  })
  .refine((d) => d.to !== "cancelled" || d.cancelReason != null, {
    message: "Choose a reason",
    path: ["cancelReason"],
  });
export type OverrideStageInput = z.infer<typeof overrideStageSchema>;

// ---- full stored document -----------------------------------------------------------

export const enquiryDocSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  code: z.string(),
  brandId: optionalObjectIdString,
  contactId: optionalObjectIdString,
  industry: z.enum(BRAND_CATEGORIES).nullable().optional(),
  source: z.enum(ENQUIRY_SOURCES),
  sourceDetail: z.string().nullable().optional(),
  brief: briefSchema,
  status: z.enum(ENQUIRY_STATUSES),
  shortlist: z.array(shortlistEntryDocSchema).default([]),
  outcome: outcomeSchema.default({}),
  booking: bookingSchema.default({ offPlatform: false, currency: "INR" }),
  schedule: scheduleSchema.default({ delayEvents: [] }),
  feedback: feedbackSchema.default({}),
  feedbackWaived: z.boolean().optional(),
  feedbackWaivedNote: z.string().nullable().optional(),
  // Lenient here (unlike enquiryCreateSchema) — old records predate this field.
  enquiryDate: z.coerce.date().nullable().optional(),
  ownerId: optionalObjectIdString,
  /** Required on every open enquiry; null once closed (except post-shoot tasks on Done). */
  followUp: followUpSchema.nullable().optional(),
  /** No-replies logged in a row, and when the first of them was — the cadence counts from there. */
  noReplyCount: z.number().default(0),
  noReplyStartedAt: z.date().nullable().optional(),
  lastActivityAt: z.date().nullable().optional(),
  /** Last workflow activity — Undo only applies while nothing has happened since. */
  lastActivityId: z.string().nullable().optional(),
  lastContactedAt: z.date().nullable().optional(),
  firstResponseAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  updatedBy: z.string(),
});
export type EnquiryDoc = z.infer<typeof enquiryDocSchema>;
