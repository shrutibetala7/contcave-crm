import { z } from "zod";

/**
 * Reference fields (brandId, contactId, ownerId, ...) are stored as plain
 * strings equal to the referenced document's serialized `id` — only the
 * Mongo `_id` itself is a real ObjectId. This keeps the API boundary and
 * every filter/equality check simple (no ObjectId casting except for
 * primary-key lookups). See src/lib/db/objectId.ts.
 */
export const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-character hex id");

export const optionalObjectIdString = objectIdString.nullable().optional();

export const e164Phone = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "must be E.164, e.g. +919876543210");

type Loosened<S extends z.ZodRawShape> = {
  [K in keyof S]: z.ZodOptional<S[K] extends z.ZodDefault<infer I extends z.ZodType> ? I : S[K]>;
};

/**
 * Schema for a PATCH body: every key optional, and — unlike Zod v4's
 * `.partial()` — with `.default(...)` stripped. `.partial()` keeps inner
 * defaults, so a PATCH of one field parses to a payload that also carries
 * every defaulted sibling (`onboarding.gst: false`, `contacts: []`,
 * `brief.fieldEvidence: {}`), and the routes' `$set` then silently resets
 * whatever the client didn't send.
 */
export function patchOf<S extends z.ZodRawShape>(schema: z.ZodObject<S>): z.ZodObject<Loosened<S>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    const base = (field instanceof z.ZodDefault ? field.unwrap() : field) as z.ZodType;
    shape[key] = base.optional();
  }
  return z.object(shape) as unknown as z.ZodObject<Loosened<S>>;
}
