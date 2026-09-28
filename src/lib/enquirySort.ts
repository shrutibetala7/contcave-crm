import type { Filter, Document } from "mongodb";
import type { EnquiryMongo } from "@/lib/db/collections";

/**
 * Two-tier sort, computed at query time rather than stored so it's never
 * out of sync with either field:
 *
 *   1. Enquiries with a shoot date come first, soonest shoot date on top —
 *      that's the operationally urgent group.
 *   2. Enquiries with no shoot date yet follow, newest enquiry first (falling
 *      back to `createdAt` on pre-migration records) — so a fresh, active
 *      lead surfaces above one that's been sitting untouched, instead of the
 *      oldest stale lead floating to the top.
 *
 * Both tiers are expressed as one ascending sort key: within the shoot-date
 * tier the key *is* the shoot date (ascending = soonest first); within the
 * no-shoot-date tier the key is the enquiry date negated (ascending on a
 * negated value = descending on the real value = newest first).
 */
export function buildEnquirySortPipeline(filter: Filter<EnquiryMongo>, limit: number): Document[] {
  return [
    { $match: filter },
    { $addFields: { _shootDate: { $min: "$brief.preferredDates" } } },
    {
      $addFields: {
        _hasShootDate: { $cond: [{ $eq: ["$_shootDate", null] }, 0, 1] },
        _sortKey: {
          $cond: [
            { $eq: ["$_shootDate", null] },
            { $multiply: [-1, { $toLong: { $ifNull: ["$enquiryDate", "$createdAt"] } }] },
            { $toLong: "$_shootDate" },
          ],
        },
      },
    },
    { $sort: { _hasShootDate: -1, _sortKey: 1 } },
    { $limit: limit },
    { $project: { _shootDate: 0, _hasShootDate: 0, _sortKey: 0 } },
  ];
}
