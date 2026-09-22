import { z } from "zod";
import {
  BRAND_CATEGORIES,
  CANCEL_REASONS,
  DELAY_CAUSED_BY,
  ENQUIRY_SOURCES,
  ENQUIRY_STATUSES,
  FEEDBACK_ISSUES,
  LOSS_REASONS,
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
  rawText: z.string().min(1),
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
    nextActionDate: z.coerce.date().nullable().optional(),
    // Change Brief v1.1 §B: a next action with no reason is a date with no
    // context — required in the same payload whenever a date is set.
    nextActionReason: z.string().nullable().optional(),
  })
  .refine((d) => d.nextActionDate == null || (d.nextActionReason?.trim().length ?? 0) >= 8, {
    message: "nextActionReason is required (min 8 characters) whenever nextActionDate is set",
    path: ["nextActionReason"],
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
});
export type Booking = z.infer<typeof bookingSchema>;

// ---- enquiry update ---------------------------------------------------------

// status, shortlist, schedule.delayEvents and feedback are all mutated
// through their own dedicated endpoints (spec §5). outcome.result is only
// ever set by a status transition (it's guarded). booking has no dedicated
// endpoint in spec §5, so it's set here — it must exist before a
// transition to "confirmed" can pass that guard (spec §4.1).
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
    nextActionDate: z.coerce.date().nullable().optional(),
    nextActionReason: z.string().nullable().optional(),
    lastContactedAt: z.coerce.date().nullable().optional(),
    firstResponseAt: z.coerce.date().nullable().optional(),
  })
  .refine((d) => d.nextActionDate == null || (d.nextActionReason?.trim().length ?? 0) >= 8, {
    message: "nextActionReason is required (min 8 characters) whenever nextActionDate is set",
    path: ["nextActionReason"],
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

// ---- status transition ------------------------------------------------------------

export const statusChangeSchema = z.object({
  to: z.string(),
  note: z.string().nullable().optional(),
  // guard payloads — only the relevant ones are required per-transition,
  // enforced in lib/stateMachine/enquiryStatus.ts
  lossReason: z.enum(LOSS_REASONS).nullable().optional(),
  lossNote: z.string().nullable().optional(),
  competitorName: z.string().nullable().optional(),
  cancelReason: z.enum(CANCEL_REASONS).nullable().optional(),
  cancelNote: z.string().nullable().optional(),
  nextActionDate: z.coerce.date().nullable().optional(),
  nextActionReason: z.string().nullable().optional(),
});
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;

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
  nextActionDate: z.date().nullable().optional(),
  nextActionReason: z.string().nullable().optional(),
  lastContactedAt: z.date().nullable().optional(),
  firstResponseAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  updatedBy: z.string(),
});
export type EnquiryDoc = z.infer<typeof enquiryDocSchema>;
