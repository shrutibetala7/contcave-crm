import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { enquiriesCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { feedbackCreateSchema } from "@/lib/validation/enquiry";
import { writeActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const body = await parseJson(request);
    const { side, ...payload } = feedbackCreateSchema.parse(body);

    const enquiries = await enquiriesCol();
    const now = new Date();
    const result = await enquiries.findOneAndUpdate(
      { _id: toObjectId(id), tenantId: session.tenantId },
      {
        $set: {
          [`feedback.${side}`]: { ...payload, collectedAt: now, collectedBy: session.sub },
          updatedAt: now,
          updatedBy: session.sub,
        },
      },
      { returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Enquiry");

    await writeActivity({
      tenantId: session.tenantId,
      entityType: "enquiry",
      entityId: id,
      type: "note",
      body: `${side === "client" ? "Client" : "Studio"} feedback collected`,
      createdBy: session.sub,
    });

    return NextResponse.json({ data: serialize(result) });
  });
}
