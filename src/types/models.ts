/**
 * Component-facing barrel: the shapes UI code should import. These are the
 * serialized (id: string, dates as Date) API-boundary types, derived from
 * the zod schemas in src/lib/validation/* (single source of truth — see
 * SPEC.md §"Types" decision in the build plan).
 */

export type { BrandDoc, BrandCreateInput, BrandUpdateInput } from "@/lib/validation/brand";
export type { ContactDoc, ContactCreateInput, ContactUpdateInput } from "@/lib/validation/contact";
export type {
  StudioDoc,
  StudioCreateInput,
  StudioUpdateInput,
  Onboarding,
} from "@/lib/validation/studio";
export type {
  EnquiryDoc,
  EnquiryCreateInput,
  EnquiryUpdateInput,
  Brief,
  ShortlistEntryDoc,
  ShortlistCreateInput,
  ShortlistUpdateInput,
  Outcome,
  Booking,
  Schedule,
  DelayEventDoc,
  DelayCreateInput,
  DelayUpdateInput,
  Feedback,
  StatusChangeInput,
  FieldEvidence,
} from "@/lib/validation/enquiry";
export type { ActivityDoc, ActivityCreateInput } from "@/lib/validation/activity";
export type { UserDoc, PublicUser } from "@/lib/validation/user";

export type {
  EnquiryStatus,
  EnquirySource,
  ShootType,
  ShortlistOutcome,
  LossReason,
  DelayCausedBy,
  FeedbackIssue,
  StudioStage,
  StudioCategory,
  GstStatus,
  CommercialModel,
  AgreementStatus,
  BrandCategory,
  ContactRole,
  UserRole,
  ActivityType,
  ActivityEntityType,
  ActivityDirection,
} from "@/lib/enums";
