import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { enquiriesCol, studiosCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { shortlistCreateSchema } from "@/lib/validation/enquiry";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const body = await parseJson(request);
    const input = shortlistCreateSchema.parse(body);

    const studios = await studiosCol();
    const studio = await studios.findOne({
      _id: toObjectId(input.studioId),
      tenantId: session.tenantId,
    });
    if (!studio) throw new NotFoundError("Studio");

    const enquiries = await enquiriesCol();
    const entry = {
      id: new ObjectId().toHexString(),
      studioId: input.studioId,
      studioName: studio.name,
      quotedAmount: input.quotedAmount ?? null,
      sentAt: new Date(),
      studioRespondedAt: null,
      outcome: "pending" as const,
      outcomeNote: null,
    };

    const result = await enquiries.findOneAndUpdate(
      { _id: toObjectId(id), tenantId: session.tenantId },
      {
        $push: { shortlist: entry },
        $set: { updatedAt: new Date(), updatedBy: session.sub },
      },
      { returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Enquiry");
    return NextResponse.json({ data: serialize(result) }, { status: 201 });
  });
}
