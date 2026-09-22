import type { Filter, Document } from "mongodb";
import type { EnquiryMongo } from "@/lib/db/collections";

/**
 * "Sort by shoot date; if there isn't one, by enquiry date" — computed at
 * query time rather than stored, so it's never out of sync with either
 * field. `$min` on an array expression returns its smallest element (an
 * empty array or a missing field both fall through to $ifNull), so this
 * picks the earliest shoot date if any were entered, otherwise the enquiry
 * date, otherwise (pre-migration records) when the record was created.
 */
export function buildEnquirySortPipeline(filter: Filter<EnquiryMongo>, direction: 1 | -1, limit: number): Document[] {
  return [
    { $match: filter },
    {
      $addFields: {
        _sortDate: {
          $ifNull: [{ $min: "$brief.preferredDates" }, { $ifNull: ["$enquiryDate", "$createdAt"] }],
        },
      },
    },
    { $sort: { _sortDate: direction } },
    { $limit: limit },
    { $project: { _sortDate: 0 } },
  ];
}
