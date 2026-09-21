import { countersCol } from "@/lib/db/collections";

/**
 * ENQ-<year>-<seq, 4-digit> via an atomic counter document. Not part of the
 * business schema in spec §3 — a small implementation detail to satisfy
 * "code, // human-readable, e.g. 'ENQ-2026-0142'. Generate on insert."
 */
export async function nextEnquiryCode(date: Date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const counterId = `ENQ-${year}`;
  const counters = await countersCol();
  const result = await counters.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const seq = result?.seq ?? 1;
  return `ENQ-${year}-${String(seq).padStart(4, "0")}`;
}
