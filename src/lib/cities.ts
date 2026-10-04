/**
 * Cities are free text on both enquiries and studios ("New Delhi", "Gurgaon",
 * "delhi ncr"…). To compare demand with supply they have to land on the same
 * key — a metro counts as one market, since a Noida client will shoot in
 * Gurugram. Client-safe.
 */
const ALIASES: Record<string, string> = {
  delhi: "Delhi NCR",
  "new delhi": "Delhi NCR",
  "delhi ncr": "Delhi NCR",
  ncr: "Delhi NCR",
  gurgaon: "Delhi NCR",
  gurugram: "Delhi NCR",
  noida: "Delhi NCR",
  "greater noida": "Delhi NCR",
  ghaziabad: "Delhi NCR",
  faridabad: "Delhi NCR",
  mumbai: "Mumbai",
  bombay: "Mumbai",
  "navi mumbai": "Mumbai",
  thane: "Mumbai",
  bangalore: "Bengaluru",
  bengaluru: "Bengaluru",
  calcutta: "Kolkata",
  kolkata: "Kolkata",
  madras: "Chennai",
  chennai: "Chennai",
  gurgoan: "Delhi NCR",
  luckow: "Lucknow",
};

export function marketFor(city: string | null | undefined): string | null {
  const key = city?.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  if (ALIASES[key]) return ALIASES[key];
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}
