/**
 * Change Brief v1.1 §C: `sort` query param, e.g. `-nextActionDate`. Parsed
 * against an allowlist per list page — never trust an arbitrary field name
 * into a Mongo sort spec.
 */
export function parseSortParam(
  sort: string | undefined | null,
  allowed: readonly string[],
  fallback: Record<string, 1 | -1>
): Record<string, 1 | -1> {
  if (!sort) return fallback;
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  if (!allowed.includes(field)) return fallback;
  return { [field]: desc ? -1 : 1 };
}
