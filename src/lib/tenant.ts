/**
 * ContCave runs a single tenant today (spec §3: "There is exactly one tenant
 * now. Do not build multi-tenancy; do not omit the field."). Every document
 * still carries tenantId so a future multi-tenant migration is a data
 * backfill, not a schema change.
 */
export const DEFAULT_TENANT_ID = "contcave";
