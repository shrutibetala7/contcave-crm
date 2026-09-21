import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { enquiriesCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { enquiryUpdateSchema } from "@/lib/validation/enquiry";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const enquiries = await enquiriesCol();
    const doc = await enquiries.findOne({ _id: toObjectId(id), tenantId: session.tenantId });
    if (!doc) throw new NotFoundError("Enquiry");
    return NextResponse.json({ data: serialize(doc) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const body = await parseJson(request);
    const input = enquiryUpdateSchema.parse(body);

    const enquiries = await enquiriesCol();
    const _id = toObjectId(id);

    const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: session.sub };
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (key === "brief" && value && typeof value === "object") {
        for (const [briefKey, briefValue] of Object.entries(value)) {
          if (briefValue !== undefined) set[`brief.${briefKey}`] = briefValue;
        }
        continue;
      }
      if (key === "booking" && value && typeof value === "object") {
        for (const [bookingKey, bookingValue] of Object.entries(value)) {
          if (bookingValue !== undefined) set[`booking.${bookingKey}`] = bookingValue;
        }
        continue;
      }
      set[key] = value;
    }

    const result = await enquiries.findOneAndUpdate(
      { _id, tenantId: session.tenantId },
      { $set: set },
      { returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Enquiry");
    return NextResponse.json({ data: serialize(result) });
  });
}
