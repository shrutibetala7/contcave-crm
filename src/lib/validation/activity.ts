import { z } from "zod";
import { ACTIVITY_DIRECTIONS, ACTIVITY_ENTITY_TYPES, ACTIVITY_TYPES } from "@/lib/enums";
import { objectIdString } from "@/lib/validation/common";

export const activityCreateSchema = z.object({
  entityType: z.enum(ACTIVITY_ENTITY_TYPES),
  entityId: objectIdString,
  type: z.enum(ACTIVITY_TYPES),
  direction: z.enum(ACTIVITY_DIRECTIONS).nullable().optional(),
  body: z.string().nullable().optional(),
  occurredAt: z.coerce.date().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;

export const activityDocSchema = activityCreateSchema.extend({
  id: z.string(),
  tenantId: z.string(),
  occurredAt: z.date(),
  createdBy: z.string(),
  createdAt: z.date(),
});
export type ActivityDoc = z.infer<typeof activityDocSchema>;
