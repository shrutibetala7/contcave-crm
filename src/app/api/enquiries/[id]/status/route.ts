import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { enquiriesCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { statusChangeSchema } from "@/lib/validation/enquiry";
import { assertValidTransition } from "@/lib/stateMachine/enquiryStatus";
import { writeStatusChangeActivity } from "@/lib/activity";
import { recomputeBrandRollups } from "@/lib/brandRollup";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const body = await parseJson(request);
    const input = statusChangeSchema.parse(body);

    const enquiries = await enquiriesCol();
    const _id = toObjectId(id);
    const enquiry = await enquiries.findOne({ _id, tenantId: session.tenantId });
    if (!enquiry) throw new NotFoundError("Enquiry");

    const { set } = assertValidTransition(enquiry, input.to, input);
    set.updatedAt = new Date();
    set.updatedBy = session.sub;

    const result = await enquiries.findOneAndUpdate(
      { _id, tenantId: session.tenantId },
      { $set: set },
      { returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Enquiry");

    await writeStatusChangeActivity({
      tenantId: session.tenantId,
      entityType: "enquiry",
      entityId: id,
      from: enquiry.status,
      to: input.to,
      note: input.note,
      createdBy: session.sub,
    });

    if ((input.to === "closed_won" || input.to === "lost") && result.brandId) {
      await recomputeBrandRollups(session.tenantId, result.brandId);
    }

    return NextResponse.json({ data: serialize(result) });
  });
}
