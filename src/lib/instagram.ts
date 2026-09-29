/**
 * Normalize an Instagram handle for storage and dedupe: accepts "@name",
 * "name", or a profile URL, and returns the bare lowercase handle — or null
 * if what's left isn't a valid handle (1–30 of a–z, 0–9, "." and "_").
 * Client-safe.
 */
export function normalizeInstagramHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let handle = raw.trim();
  const fromUrl = handle.match(/instagram\.com\/([^/?#\s]+)/i);
  if (fromUrl) handle = fromUrl[1];
  handle = handle.replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

export function instagramProfileUrl(handle: string): string {
  return `https://instagram.com/${handle}`;
}
