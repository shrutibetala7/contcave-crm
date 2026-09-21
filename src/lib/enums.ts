/**
 * Single source of truth for every enum in spec §3–§4. Zod schemas build
 * `z.enum(...)` from these arrays; UI components (filter chips, dropdowns)
 * import the same arrays so labels never drift from validation.
 */

export const ENQUIRY_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "shortlist_sent",
  "negotiating",
  "confirmed",
  "scheduled",
  "delayed",
  "completed",
  "feedback_pending",
  "closed_won",
  "dormant",
  "lost",
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

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

export const STUDIO_STAGES = [
  "lead",
  "contacted",
  "negotiating",
  "agreement_sent",
  "onboarding",
  "active",
  "not_interested",
  "paused",
  "churned",
] as const;
export type StudioStage = (typeof STUDIO_STAGES)[number];

export const STUDIO_TIERS = ["verified", "curated"] as const;
export type StudioTier = (typeof STUDIO_TIERS)[number];

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

export const BRAND_CATEGORIES = [
  "d2c_fashion",
  "beauty",
  "food",
  "agency",
  "creator",
  "other",
] as const;
export type BrandCategory = (typeof BRAND_CATEGORIES)[number];

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
