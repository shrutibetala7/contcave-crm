/**
 * Single source of truth for every enum in spec §3–§4. Zod schemas build
 * `z.enum(...)` from these arrays; UI components (filter chips, dropdowns)
 * import the same arrays so labels never drift from validation.
 */

/**
 * The enquiry pipeline, simplified to seven statuses. Any non-terminal
 * status can move to any other (see stateMachine/enquiryStatus.ts) —
 * there's no forced march through sub-stages any more. Confirmed carries
 * the old "closed_won" meaning (the deal is done, the lead becomes a
 * customer); Cancelled and Lost are both dead ends but for different
 * reasons (an operational reason — the shoot itself fell through — vs. a
 * commercial one — the deal was lost).
 */
export const ENQUIRY_STATUSES = [
  "new_lead",
  "in_progress",
  "confirmed",
  "on_hold",
  "cancelled",
  "lost",
  "dormant",
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new_lead: "New Lead",
  in_progress: "In Progress",
  confirmed: "Confirmed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
  lost: "Lost",
  dormant: "Dormant",
};

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

export const LOSS_REASONS = [
  "price",
  "availability",
  "studio_declined",
  "went_direct",
  "chose_competitor",
  "project_cancelled",
  "no_response",
  "budget_too_low",
  "out_of_scope",
  "other",
] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

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
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_ENTITY_TYPES = ["enquiry", "studio", "brand"] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const ACTIVITY_DIRECTIONS = ["in", "out"] as const;
export type ActivityDirection = (typeof ACTIVITY_DIRECTIONS)[number];
