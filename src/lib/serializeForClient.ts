/**
 * React/Next's RSC boundary does support passing Date objects from Server
 * to Client Components directly, but round-tripping through JSON first
 * (which turns every Date into an ISO string) removes any doubt for data
 * that was fetched straight from the Mongo driver and is about to cross
 * that boundary — cheap, and every call site already does `new Date(x)`
 * rather than using the value as a Date directly, so a string works fine.
 */
export function toClientSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
