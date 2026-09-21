import { z } from "zod";
import { BRAND_CATEGORIES } from "@/lib/enums";

export const brandCreateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(BRAND_CATEGORIES).nullable().optional(),
  city: z.string().nullable().optional(),
  instagramHandle: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type BrandCreateInput = z.infer<typeof brandCreateSchema>;

export const brandUpdateSchema = brandCreateSchema.partial();
export type BrandUpdateInput = z.infer<typeof brandUpdateSchema>;

export const brandDocSchema = brandCreateSchema.extend({
  id: z.string(),
  tenantId: z.string(),
  totalEnquiries: z.number(),
  totalWon: z.number(),
  lifetimeValue: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  updatedBy: z.string(),
});
export type BrandDoc = z.infer<typeof brandDocSchema>;
