import { z } from "zod";
import { CONTACT_ROLES } from "@/lib/enums";
import { e164Phone, optionalObjectIdString } from "@/lib/validation/common";

const contactFields = z.object({
  brandId: optionalObjectIdString,
  name: z.string().min(1),
  // Accepted loose here on purpose — the route normalizes via
  // normalizePhone() (spec §3.3) / normalizeInstagramHandle() and rejects
  // with a clear error if that fails, rather than a raw regex mismatch from zod.
  phone: z.string().nullable().optional(),
  whatsappNumber: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  instagramHandle: z.string().nullable().optional(),
  role: z.enum(CONTACT_ROLES).nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
});

// Phone and Instagram are both optional: plenty of leads arrive as an
// Instagram DM with no number, and some get saved before either is known
// (Quick Add warns, but lets them through). A contact then carries just a name.
export const contactCreateSchema = contactFields;
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;

export const contactUpdateSchema = contactFields.partial();
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;

export const contactDocSchema = contactFields.extend({
  id: z.string(),
  tenantId: z.string(),
  // Set once any of this contact's enquiries reaches "confirmed" — a lead
  // becomes a customer (see stateMachine/enquiryStatus.ts). Never unset.
  isCustomer: z.boolean().default(false),
  // Stored values are always normalized (the route guarantees this before
  // insert). Either, both or neither of phone / instagramHandle may be set.
  phone: e164Phone.nullable(),
  whatsappNumber: e164Phone.nullable(), // defaults to phone on write
  instagramHandle: z.string().nullable(), // bare lowercase handle, no "@"
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  updatedBy: z.string(),
});
export type ContactDoc = z.infer<typeof contactDocSchema>;
