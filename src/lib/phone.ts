/**
 * Normalize a phone number to E.164. `contacts.phone` is the dedupe key
 * (spec §3.3), so every write path must funnel through this first.
 *
 * Heuristic, not a full libphonenumber: strips punctuation/spaces, assumes
 * a bare 10-digit number is Indian (+91) since that's the operating
 * market, and otherwise requires the caller to already include a country
 * code. Good enough for Phase 1; swap for a real phone-number library if
 * international volume shows up.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits) return null;

  if (digits.startsWith("+")) {
    const rest = digits.slice(1);
    if (!/^[1-9]\d{7,14}$/.test(rest)) return null;
    return `+${rest}`;
  }
  if (/^0\d{10}$/.test(digits)) {
    return `+91${digits.slice(1)}`;
  }
  if (/^91\d{10}$/.test(digits)) {
    return `+${digits}`;
  }
  if (/^\d{10}$/.test(digits)) {
    return `+91${digits}`;
  }
  return null;
}

export function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}
