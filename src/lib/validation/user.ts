import { z } from "zod";
import { USER_ROLES } from "@/lib/enums";

export const userDocSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: z.enum(USER_ROLES),
  active: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type UserDoc = z.infer<typeof userDocSchema>;

/** Safe-for-client shape: never send passwordHash to the browser. */
export type PublicUser = UserDoc;
