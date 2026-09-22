import { z } from "zod";
import { CONTACT_ROLES } from "@/lib/enums";
import { e164Phone, optionalObjectIdString } from "@/lib/validation/common";

export const contactCreateSchema = z.object({
  brandId: optionalObjectIdString,
  name: z.string().min(1),
  // Accepted loose here on purpose — the route normalizes via
  // normalizePhone() (spec §3.3) and rejects with a clear error if that
  // fails, rather than a raw regex mismatch from zod.
  phone: z.string().min(1),
  whatsappNumber: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  instagramHandle: z.string().nullable().optional(),
  role: z.enum(CONTACT_ROLES).nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
});
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;

export const contactUpdateSchema = contactCreateSchema.partial();
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;

export const contactDocSchema = contactCreateSchema.extend({
  id: z.string(),
  tenantId: z.string(),
  // Set once any of this contact's enquiries reaches "confirmed" — a lead
  // becomes a customer (see stateMachine/enquiryStatus.ts). Never unset.
  isCustomer: z.boolean().default(false),
  // Stored values are always normalized (the route guarantees this before insert).
  phone: e164Phone,
  whatsappNumber: e164Phone, // defaults to phone on write, never null once stored
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  updatedBy: z.string(),
});
export type ContactDoc = z.infer<typeof contactDocSchema>;
