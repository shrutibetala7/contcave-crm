import { BRAND_CATEGORY_LABELS, type BrandCategory } from "@/lib/enums";

/**
 * How an enquiry is named anywhere a person has to recognise it: by who it
 * is, not by its code. The code is the last resort, only when nothing about
 * the person or business was recorded. Client-safe.
 *
 * "Unknown" is what older Quick Add saves stored when no name was given;
 * it's treated as no name so it falls through to something recognisable.
 */
export function enquiryDisplayName(input: {
  code: string;
  contactName?: string | null;
  brandName?: string | null;
  instagramHandle?: string | null;
  phone?: string | null;
  industry?: BrandCategory | null;
  /** The customer's own words — a last clue to who this is when nothing else was recorded. */
  query?: string | null;
}): { title: string; subtitle: string | null } {
  const contactName = input.contactName?.trim() && input.contactName.trim() !== "Unknown" ? input.contactName.trim() : null;
  const industry = input.industry ? BRAND_CATEGORY_LABELS[input.industry] : null;
  const instagram = input.instagramHandle ? `@${input.instagramHandle}` : null;

  if (contactName) return { title: contactName, subtitle: input.brandName ?? industry };
  if (input.brandName) return { title: input.brandName, subtitle: industry };
  const reachable = instagram ?? input.phone ?? null;
  if (reachable) return { title: reachable, subtitle: industry };
  if (industry) return { title: industry, subtitle: input.code };
  const query = input.query?.trim().replace(/\s+/g, " ");
  return { title: input.code, subtitle: query ? `“${query.length > 60 ? `${query.slice(0, 57)}…` : query}”` : null };
}
