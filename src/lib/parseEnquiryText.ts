import { SHOOT_TYPES, type ShootType } from "@/lib/enums";
import { normalizePhone } from "@/lib/phone";

/**
 * Heuristic (non-LLM) implementation of spec §5.1's paste-parse endpoint,
 * extended per Change Brief v1.1 §A: every field is classified as
 * "observed" (lifted from a literal, checkable substring of the pasted
 * text — sourceSpan is that substring) or "inferred" (a judgment call:
 * category labels like shootType, derived booleans like datesFlexible —
 * even when a triggering keyword exists, the *stored value* isn't a
 * substring of the text, so it can never be "observed"). Fields the
 * heuristic never attempts stay {value: null, evidence: null, sourceSpan: null}.
 *
 * No Anthropic API in this build (confirmed with the user) — this runs the
 * spec's own documented degrade path ("on parse failure ... degrade to
 * manual entry, never block the save") as the primary path instead of a
 * fallback. Swap in a real LLM call later by replacing the body of
 * parseEnquiryText() — verifyFieldEvidence() is the seam that keeps a
 * model honest either way (it re-checks every sourceSpan against rawText
 * server-side and downgrades anything that doesn't literally match).
 */

export interface ParsedField<T = unknown> {
  value: T | null;
  // "stated" never comes out of the parser itself — it's what a field
  // becomes client-side once a human directly edits its value (see
  // QuickAddModal.tsx's setValue()), included here so that's a valid state
  // for the same type rather than a separate one.
  evidence: "observed" | "inferred" | "stated" | null;
  sourceSpan: string | null;
}

export interface ParsedFields {
  "contact.name": ParsedField<string>;
  "contact.phone": ParsedField<string>;
  "brand.name": ParsedField<string>;
  "brief.shootType": ParsedField<ShootType>;
  "brief.deliverables": ParsedField<string>;
  "brief.city": ParsedField<string>;
  "brief.preferredLocality": ParsedField<string>;
  "brief.durationHours": ParsedField<number>;
  "brief.crewSize": ParsedField<number>;
  "brief.budgetMin": ParsedField<number>;
  "brief.budgetMax": ParsedField<number>;
  "brief.requirements": ParsedField<string[]>;
  "brief.datesFlexible": ParsedField<boolean>;
}

export type ParsedFieldKey = keyof ParsedFields;

/** Render order for the quick-add review form. */
export const PARSED_FIELD_ORDER: ParsedFieldKey[] = [
  "contact.name",
  "contact.phone",
  "brand.name",
  "brief.shootType",
  "brief.city",
  "brief.preferredLocality",
  "brief.deliverables",
  "brief.durationHours",
  "brief.crewSize",
  "brief.budgetMin",
  "brief.budgetMax",
  "brief.requirements",
  "brief.datesFlexible",
];

export interface ParsedFieldsResponse {
  fields: ParsedFields;
  rawText: string;
  parseError: boolean;
}

function observed<T>(value: T | null, sourceSpan: string | null): ParsedField<T> {
  return value != null && sourceSpan ? { value, evidence: "observed", sourceSpan } : empty<T>();
}

function inferred<T>(value: T | null): ParsedField<T> {
  return value != null ? { value, evidence: "inferred", sourceSpan: null } : empty<T>();
}

function empty<T>(): ParsedField<T> {
  return { value: null, evidence: null, sourceSpan: null };
}

const SHOOT_TYPE_KEYWORDS: Record<ShootType, string[]> = {
  product: ["product shoot", "product photo", "catalogue", "catalog", "sku"],
  fashion: ["fashion shoot", "lookbook", "editorial"],
  campaign: ["campaign"],
  ugc: ["ugc", "user generated"],
  podcast: ["podcast"],
  video: ["video shoot", "reel", "ad film", "commercial"],
  event: ["event shoot", "launch event"],
  other: [],
};

const REQUIREMENT_KEYWORDS = [
  "cyclorama",
  "makeup room",
  "parking",
  "natural light",
  "daylight",
  "green screen",
  "chroma",
  "changing room",
];

const KNOWN_CITIES = ["Mumbai", "Delhi", "Bangalore", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Kolkata"];

const PHONE_REGEX = /(\+?\d[\d\s-]{8,14}\d)/g;

function guessContactName(text: string): ParsedField<string> {
  const patterns = [
    // Trigger phrase case-insensitive; the captured name itself is not —
    // a case-insensitive [A-Z] would also match a lowercase word right
    // after the trigger (e.g. "this is Ridhi here" capturing "Ridhi here").
    /(?:[Tt]his is|[Ii] am|[Ii]'m)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/,
    /^[Hh]i,?\s*(?:[Tt]his is|[Ii]'m|[Ii] am)?\s*([A-Z][a-z]+)/m,
    /-\s*([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\s*$/m, // WhatsApp-style signature line
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return observed(match[1].trim(), match[0].trim());
  }
  return empty();
}

function guessBrandName(text: string): ParsedField<string> {
  const match = text.match(/from\s+([A-Z][\w&' ]{1,40}?)(?:[.,\n]|$)/);
  return match?.[1] ? observed(match[1].trim(), match[0].trim()) : empty();
}

function guessShootType(text: string): ParsedField<ShootType> {
  const lower = text.toLowerCase();
  for (const type of SHOOT_TYPES) {
    if (SHOOT_TYPE_KEYWORDS[type].some((kw) => lower.includes(kw))) {
      // Category label, not a lifted string — always inferred, per spec §A's own example.
      return inferred(type);
    }
  }
  return empty();
}

function guessRequirements(text: string): ParsedField<string[]> {
  const lower = text.toLowerCase();
  const found = REQUIREMENT_KEYWORDS.filter((kw) => lower.includes(kw));
  return found.length ? observed(found, found.join(", ")) : empty();
}

function guessCity(text: string): ParsedField<string> {
  for (const city of KNOWN_CITIES) {
    const match = text.match(new RegExp(`(?:in |at |based in |based out of )?${city}`, "i"));
    if (match) return observed(city, match[0]);
  }
  return empty();
}

function guessBudget(text: string): { min: ParsedField<number>; max: ParsedField<number> } {
  const rangeMatch = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]) * 1000;
    const max = parseFloat(rangeMatch[2]) * 1000;
    return { min: observed(min, rangeMatch[0]), max: observed(max, rangeMatch[0]) };
  }
  const singleMatch = text.match(/(?:₹|rs\.?|inr)\s*(\d[\d,]*)/i);
  if (singleMatch) {
    const value = parseInt(singleMatch[1].replace(/,/g, ""), 10);
    const field = observed(value, singleMatch[0]);
    return { min: field, max: field };
  }
  return { min: empty(), max: empty() };
}

function guessDurationHours(text: string): ParsedField<number> {
  const match = text.match(/(\d+)\s*(?:hour|hr)s?/i);
  return match ? observed(parseInt(match[1], 10), match[0]) : empty();
}

function guessCrewSize(text: string): ParsedField<number> {
  const match = text.match(/(\d+)\s*(?:people|crew|pax)/i);
  return match ? observed(parseInt(match[1], 10), match[0]) : empty();
}

function guessDatesFlexible(text: string): ParsedField<boolean> {
  const match = text.match(/flexible|either works|any day|whenever/i);
  // A derived yes/no judgment, not a lifted value — always inferred when triggered.
  return match ? inferred(true) : empty();
}

function guessPhone(text: string): ParsedField<string> {
  const matches = text.match(PHONE_REGEX) ?? [];
  for (const candidate of matches) {
    const normalized = normalizePhone(candidate);
    if (normalized) return observed(normalized, candidate.trim());
  }
  return empty();
}

/**
 * Re-checks every "observed" field's sourceSpan actually occurs in
 * rawText, downgrading to "inferred" (and logging) if not — the
 * acceptance criterion this satisfies, and the seam that keeps a future
 * real model call honest.
 */
export function verifyFieldEvidence(fields: ParsedFields, rawText: string): ParsedFields {
  // Cast to a homogeneous shape for the loop: every branch only touches the
  // evidence/sourceSpan metadata (never `value`), so the per-key value type
  // (T in ParsedField<T>) is irrelevant here — TS can't correlate a union
  // key with its per-key value type across a generic index assignment, so
  // this is the honest way to express "same operation, every field".
  const verified = { ...fields } as unknown as Record<string, ParsedField<unknown>>;
  for (const key of Object.keys(verified)) {
    const field = verified[key];
    if (field.evidence === "observed" && (!field.sourceSpan || !rawText.includes(field.sourceSpan))) {
      console.warn(`[parseEnquiryText] sourceSpan for "${key}" not found in rawText — downgrading to inferred`, {
        key,
        sourceSpan: field.sourceSpan,
      });
      verified[key] = { ...field, evidence: "inferred", sourceSpan: null };
    }
  }
  return verified as unknown as ParsedFields;
}

export function parseEnquiryText(rawText: string): ParsedFieldsResponse {
  const text = rawText ?? "";
  const budget = guessBudget(text);

  const fields: ParsedFields = {
    "contact.name": guessContactName(text),
    "contact.phone": guessPhone(text),
    "brand.name": guessBrandName(text),
    "brief.shootType": guessShootType(text),
    "brief.deliverables": empty(),
    "brief.city": guessCity(text),
    "brief.preferredLocality": empty(),
    "brief.durationHours": guessDurationHours(text),
    "brief.crewSize": guessCrewSize(text),
    "brief.budgetMin": budget.min,
    "brief.budgetMax": budget.max,
    "brief.requirements": guessRequirements(text),
    "brief.datesFlexible": guessDatesFlexible(text),
  };

  return {
    fields: verifyFieldEvidence(fields, text),
    rawText: text,
    parseError: false,
  };
}
