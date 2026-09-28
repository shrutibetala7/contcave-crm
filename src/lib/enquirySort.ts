import type { Filter, Document } from "mongodb";
import type { EnquiryMongo } from "@/lib/db/collections";

/**
 * "Active work on top, finished work at the bottom" — computed at query time
 * rather than stored, so it's never out of sync with the fields it reads.
 * Three tiers, top to bottom:
 *
 *   2. Upcoming (or under way): has a shoot date that hasn't fully passed.
 *      Soonest shoot on top.
 *   1. No shoot date yet. Newest enquiry on top (enquiry date, falling back
 *      to `createdAt` on pre-migration records), so a fresh lead surfaces
 *      above one that's been sitting untouched.
 *   0. Done: Completed / Cancelled / Lost, or a shoot date already behind
 *      us. Most recent on top, so old history sinks instead of crowding out
 *      live enquiries.
 *
 * Each tier is one ascending sort key: tier 2's key *is* the shoot date
 * (ascending = soonest first); the other tiers use the negated date
 * (ascending on a negated value = descending on the real one = newest
 * first).
 *
 * `today` is UTC midnight of the current calendar date (see
 * todayAsUtcMidnight) — a shoot dated today is still upcoming until tomorrow.
 * A range of dates counts as passed only once its *last* day has.
 */
export function buildEnquirySortPipeline(filter: Filter<EnquiryMongo>, limit: number, today: Date): Document[] {
  const enquiryDate = { $ifNull: ["$enquiryDate", "$createdAt"] };
  return [
    { $match: filter },
    {
      $addFields: {
        _shootStart: { $min: "$brief.preferredDates" },
        _shootEnd: { $max: "$brief.preferredDates" },
      },
    },
    {
      $addFields: {
        _tier: {
          $switch: {
            branches: [
              { case: { $in: ["$status", ["completed", "cancelled", "lost"]] }, then: 0 },
              { case: { $and: [{ $ne: ["$_shootEnd", null] }, { $lt: ["$_shootEnd", today] }] }, then: 0 },
              { case: { $eq: ["$_shootStart", null] }, then: 1 },
            ],
            default: 2,
          },
        },
      },
    },
    {
      $addFields: {
        _sortKey: {
          $cond: [
            { $eq: ["$_tier", 2] },
            { $toLong: "$_shootStart" },
            { $multiply: [-1, { $toLong: { $ifNull: ["$_shootEnd", enquiryDate] } }] },
          ],
        },
      },
    },
    { $sort: { _tier: -1, _sortKey: 1 } },
    { $limit: limit },
    { $project: { _shootStart: 0, _shootEnd: 0, _tier: 0, _sortKey: 0 } },
  ];
}
