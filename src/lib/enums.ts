/**
 * Single source of truth for every enum in spec §3–§4. Zod schemas build
 * `z.enum(...)` from these arrays; UI components (filter chips, dropdowns)
 * import the same arrays so labels never drift from validation.
 */

/**
 * The stage an enquiry is at. Nobody picks it by hand: it moves as a side
 * effect of something ops did (logging an outcome, sending options, saving
 * a booking) or of the calendar (the shoot date passing) — see
 * lib/stateMachine/enquiryStatus.ts. Admins can override it, with a reason.
 *
 * Four stages are open (on the board, always with a next follow-up); the
 * other four are closed. Parked is a lead that stopped replying — closed,
 * but revivable. Cancelled is kept apart from Lost: a shoot that fell
 * through is an operational reason, not a commercial loss.
 *
 * Stored on enquiries as `status` (the field predates the redesign).
 */
export const ENQUIRY_STATUSES = [
  "new",
  "talking",
  "options_sent",
  "confirmed",
  "done",
  "parked",
  "lost",
  "cancelled",
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  talking: "Talking",
  options_sent: "Options sent",
  confirmed: "Confirmed",
  done: "Done",
  parked: "Parked",
  lost: "Lost",
  cancelled: "Cancelled",
};

export const OPEN_STATUSES = ["new", "talking", "options_sent", "confirmed"] as const satisfies readonly EnquiryStatus[];
export const CLOSED_STATUSES = ["done", "parked", "lost", "cancelled"] as const satisfies readonly EnquiryStatus[];

export function isOpenStatus(status: EnquiryStatus): boolean {
  return (OPEN_STATUSES as readonly EnquiryStatus[]).includes(status);
}

/**
 * What ops record on Log update — one tap, at most one input each. Wants
 * options and Chose a studio hand over to the studios / booking flow, which
 * records its own activity when it completes.
 */
export const LOG_OUTCOMES = [
  "no_reply",
  "replied",
  "postponed",
  "wants_options",
  "chose_studio",
  "not_going_ahead",
] as const;
export type LogOutcome = (typeof LOG_OUTCOMES)[number];

export const LOG_OUTCOME_LABELS: Record<LogOutcome, string> = {
  no_reply: "No reply",
  replied: "Replied, still deciding",
  postponed: "Shoot postponed",
  wants_options: "Wants options",
  chose_studio: "Chose a studio",
  not_going_ahead: "Not going ahead",
};

/** The fixed list Not going ahead offers. Shoot cancelled closes as Cancelled, the rest as Lost. */
export const NOT_GOING_AHEAD_REASONS = [
  "price",
  "gst",
  "chose_competitor",
  "no_studio_in_city",
  "shoot_cancelled",
  "other",
] as const;
export type NotGoingAheadReason = (typeof NOT_GOING_AHEAD_REASONS)[number];

export const NOT_GOING_AHEAD_LABELS: Record<NotGoingAheadReason, string> = {
  price: "Price",
  gst: "GST",
  chose_competitor: "Went elsewhere",
  no_studio_in_city: "No studio in city",
  shoot_cancelled: "Shoot cancelled",
  other: "Other",
};

/** What an enquiry's one open follow-up is for. */
export const FOLLOW_UP_KINDS = [
  "first_reply",
  "chase",
  "options_check",
  "confirm_timings",
  "send_feedback",
  "collect_commission",
] as const;
export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number];

export const ENQUIRY_SOURCES = [
  "instagram_dm",
  "whatsapp",
  "website",
  "referral",
  "phone",
  "walk_in",
  "repeat_client",
  "other",
] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

export const SHOOT_TYPES = [
  "product",
  "fashion",
  "campaign",
  "ugc",
  "podcast",
  "video",
  "event",
  "other",
] as const;
export type ShootType = (typeof SHOOT_TYPES)[number];

export const SHORTLIST_OUTCOMES = [
  "pending",
  "picked",
  "rejected_price",
  "rejected_availability",
  "rejected_location",
  "rejected_look",
  "studio_declined",
  "studio_no_response",
] as const;
export type ShortlistOutcome = (typeof SHORTLIST_OUTCOMES)[number];

/**
 * Why a lead was lost — or parked (Dormant), which asks for the same reason
 * so dead leads can't hide behind a free-text "next action". The order is
 * the order the dropdown shows: most common first.
 */
export const LOSS_REASONS = [
  "price",
  "gst",
  "no_response",
  "project_cancelled",
  "no_studio_in_city",
  "chose_competitor",
  "went_direct",
  "availability",
  "studio_declined",
  "budget_too_low",
  "out_of_scope",
  "not_followed_up",
  "other",
] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  price: "Price",
  gst: "Didn't want to pay GST",
  no_response: "Ghosted / no reply",
  project_cancelled: "Shoot cancelled",
  no_studio_in_city: "No studio in their city",
  chose_competitor: "Went elsewhere",
  went_direct: "Booked the studio directly",
  availability: "Studio not available",
  studio_declined: "Studio declined",
  budget_too_low: "Budget too low",
  out_of_scope: "Not something we do",
  // Kept for records parked under the old 14-day rule — the lead went cold on our side.
  not_followed_up: "We didn't follow up",
  other: "Other",
};

/** Why an enquiry was marked Cancelled — distinct from Lost's commercial reasons. */
export const CANCEL_REASONS = [
  "shoot_rescheduled",
  "pricing_issue",
  "availability_issue",
  "shoot_cancelled",
  "other",
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  shoot_rescheduled: "Shoot Rescheduled",
  pricing_issue: "Pricing Issue",
  availability_issue: "Availability Issue",
  shoot_cancelled: "Shoot Cancelled",
  other: "Others",
};

export const DELAY_CAUSED_BY = ["client", "studio", "contcave", "external"] as const;
export type DelayCausedBy = (typeof DELAY_CAUSED_BY)[number];

export const FEEDBACK_ISSUES = [
  "cleanliness",
  "equipment",
  "access",
  "pricing",
  "staff",
  "timing",
] as const;
export type FeedbackIssue = (typeof FEEDBACK_ISSUES)[number];

/**
 * A studio is in exactly one of four states. Verified and curated both mean
 * "onboarded" — the two tiers ContCave lists — so there is no separate tier
 * field to keep in sync.
 */
export const STUDIO_STAGES = ["not_contacted", "in_progress", "verified", "curated"] as const;
export type StudioStage = (typeof STUDIO_STAGES)[number];

export const STUDIO_STAGE_LABELS: Record<StudioStage, string> = {
  not_contacted: "Not contacted",
  in_progress: "In progress",
  verified: "Verified",
  curated: "Curated",
};

export const STUDIO_CATEGORIES = [
  "photo",
  "video",
  "podcast",
  "event",
  "cyclorama",
  "daylight",
  "chroma",
] as const;
export type StudioCategory = (typeof STUDIO_CATEGORIES)[number];

export const GST_STATUSES = ["registered", "unregistered", "unknown"] as const;
export type GstStatus = (typeof GST_STATUSES)[number];

export const COMMERCIAL_MODELS = ["commission", "saas", "hybrid"] as const;
export type CommercialModel = (typeof COMMERCIAL_MODELS)[number];

export const AGREEMENT_STATUSES = ["none", "sent", "signed", "expired"] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

/**
 * What kind of business a brand (or an enquiry with no named brand) is.
 * Used two ways: as `brands.category` when the company has a name, or as
 * `enquiries.industry` when it doesn't — same taxonomy either way, so a
 * "Marketing Agency" is the same value whether or not we know its name yet.
 */
export const BRAND_CATEGORIES = [
  "marketing_agency",
  "creator",
  "fashion_brand",
  "production_house",
  "other_brand",
] as const;
export type BrandCategory = (typeof BRAND_CATEGORIES)[number];

export const BRAND_CATEGORY_LABELS: Record<BrandCategory, string> = {
  marketing_agency: "Marketing Agency",
  creator: "Creator",
  fashion_brand: "Fashion Brand",
  production_house: "Production House",
  other_brand: "Other Brand",
};

export const CONTACT_ROLES = [
  "founder",
  "marketing",
  "producer",
  "agency_poc",
  "other",
] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const USER_ROLES = ["admin", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACTIVITY_TYPES = [
  "note",
  "call",
  "whatsapp",
  "email",
  "meeting",
  "visit",
  "status_change",
  "system",
  // The lead workflow: every one of these is written by an action that also
  // moves the stage and/or the follow-up (lib/enquiryActions.ts).
  "outcome",
  "offer_sent",
  "booking",
  "stage_override",
  "followup",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_ENTITY_TYPES = ["enquiry", "studio", "brand"] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const ACTIVITY_DIRECTIONS = ["in", "out"] as const;
export type ActivityDirection = (typeof ACTIVITY_DIRECTIONS)[number];
