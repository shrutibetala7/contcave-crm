import { z } from "zod";
import {
  AGREEMENT_STATUSES,
  COMMERCIAL_MODELS,
  CONTACT_ROLES,
  GST_STATUSES,
  STUDIO_CATEGORIES,
  STUDIO_STAGES,
} from "@/lib/enums";
import { optionalObjectIdString, patchOf } from "@/lib/validation/common";

const studioContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().nullable().optional(),
  role: z.enum(CONTACT_ROLES).nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
});

const geoSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

const agreementSchema = z.object({
  status: z.enum(AGREEMENT_STATUSES).default("none"),
  signedAt: z.coerce.date().nullable().optional(),
  documentUrl: z.string().nullable().optional(),
});

const onboardingSchema = z.object({
  legalDocument: z.boolean().default(false),
  picturesVideos: z.boolean().default(false),
  pricing: z.boolean().default(false),
  packagesAmenities: z.boolean().default(false),
  aadhar: z.boolean().default(false),
  bankAccountDetails: z.boolean().default(false),
  gst: z.boolean().default(false),
});
export type Onboarding = z.infer<typeof onboardingSchema>;
export const ONBOARDING_FLAG_KEYS = onboardingSchema.keyof().options;

const studioBaseSchema = z.object({
  name: z.string().min(1),
  city: z.string().nullable().optional(),
  locality: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  geo: geoSchema.nullable().optional(),
  categories: z.array(z.enum(STUDIO_CATEGORIES)).default([]),
  gstStatus: z.enum(GST_STATUSES).default("unknown"),
  gstin: z.string().nullable().optional(),
  commercialModel: z.enum(COMMERCIAL_MODELS).nullable().optional(),
  commissionPct: z.number().nullable().optional(),
  saasPlanAnnual: z.number().nullable().optional(),
  contacts: z.array(studioContactSchema).default([]),
  instagramHandle: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  agreement: agreementSchema.default({ status: "none" }),
  onboarding: onboardingSchema.default({
    legalDocument: false,
    picturesVideos: false,
    pricing: false,
    packagesAmenities: false,
    aadhar: false,
    bankAccountDetails: false,
    gst: false,
  }),
  platformStudioId: z.string().nullable().optional(),
  // The studio's live listing on contcave.com, if one exists yet — optional,
  // since not every studio in the pipeline is listed on the platform.
  contcaveUrl: z.string().nullable().optional(),
  ownerId: optionalObjectIdString,
  tags: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
});

export const studioCreateSchema = studioBaseSchema;
export type StudioCreateInput = z.infer<typeof studioCreateSchema>;

// .partial() is shallow — it only makes top-level keys optional, so nested
// objects (onboarding, agreement) are overridden explicitly here as
// partial too. Without this, PATCHing one onboarding flag would reset the
// other five to their schema defaults (false).
export const studioUpdateSchema = patchOf(studioBaseSchema).extend({
  agreement: patchOf(agreementSchema).optional(),
  onboarding: patchOf(onboardingSchema).optional(),
});
export type StudioUpdateInput = z.infer<typeof studioUpdateSchema>;

export const studioDocSchema = studioBaseSchema.extend({
  id: z.string(),
  tenantId: z.string(),
  stage: z.enum(STUDIO_STAGES),
  lastContactedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  updatedBy: z.string(),
});
export type StudioDoc = z.infer<typeof studioDocSchema>;

export const studioStageChangeSchema = z.object({ to: z.enum(STUDIO_STAGES) });
