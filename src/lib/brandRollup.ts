import { brandsCol, enquiriesCol } from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/objectId";

/**
 * brands.{totalEnquiries,totalWon,lifetimeValue} are denormalised rollups,
 * "recomputed on enquiry close" (spec §3.2) — i.e. whenever an enquiry for
 * that brand reaches confirmed (won), lost, or cancelled.
 */
export async function recomputeBrandRollups(tenantId: string, brandId: string): Promise<void> {
  const enquiries = await enquiriesCol();
  const brands = await brandsCol();

  const [totalEnquiries, totalWon, wonValueAgg] = await Promise.all([
    enquiries.countDocuments({ tenantId, brandId }),
    enquiries.countDocuments({ tenantId, brandId, "outcome.result": "won" }),
    enquiries
      .aggregate<{ _id: null; total: number }>([
        { $match: { tenantId, brandId, "outcome.result": "won" } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$booking.grossValue", 0] } } } },
      ])
      .toArray(),
  ]);

  const lifetimeValue = wonValueAgg[0]?.total ?? 0;

  await brands.updateOne(
    { _id: toObjectId(brandId), tenantId },
    { $set: { totalEnquiries, totalWon, lifetimeValue, updatedAt: new Date() } }
  );
}
