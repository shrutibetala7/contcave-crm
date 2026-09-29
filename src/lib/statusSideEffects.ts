import { contactsCol, type EnquiryMongo } from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/objectId";
import { writeStatusChangeActivity } from "@/lib/activity";
import { recomputeBrandRollups } from "@/lib/brandRollup";

/**
 * What follows any status change, wherever it was made (the status control,
 * the board, or booking a studio): the timeline entry, the lead becoming a
 * customer once confirmed, and the brand's won/lost rollups.
 */
export async function afterStatusChange(params: {
  tenantId: string;
  enquiry: EnquiryMongo; // as it is after the change
  from: string;
  to: string;
  note?: string | null;
  userId: string;
}): Promise<void> {
  const { tenantId, enquiry, from, to } = params;
  await writeStatusChangeActivity({
    tenantId,
    entityType: "enquiry",
    entityId: enquiry._id.toHexString(),
    from,
    to,
    note: params.note ?? null,
    createdBy: params.userId,
  });

  if (to === "confirmed" && enquiry.contactId) {
    await (await contactsCol()).updateOne(
      { _id: toObjectId(enquiry.contactId), tenantId },
      { $set: { isCustomer: true, updatedAt: new Date() } }
    );
  }

  if ((to === "confirmed" || to === "lost" || to === "cancelled") && enquiry.brandId) {
    await recomputeBrandRollups(tenantId, enquiry.brandId);
  }
}
