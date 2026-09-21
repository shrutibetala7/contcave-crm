import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { enquiriesCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { shortlistUpdateSchema } from "@/lib/validation/enquiry";

type Params = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id, entryId } = await params;
    const body = await parseJson(request);
    const input = shortlistUpdateSchema.parse(body);

    const enquiries = await enquiriesCol();
    const _id = toObjectId(id);

    const existing = await enquiries.findOne({ _id, tenantId: session.tenantId });
    if (!existing) throw new NotFoundError("Enquiry");
    if (!existing.shortlist.some((entry) => entry.id === entryId)) {
      throw new NotFoundError("Shortlist entry");
    }

    // Only one entry per enquiry may be "picked" (spec §4.3) — demote any
    // other picked entry before applying this update.
    if (input.outcome === "picked") {
      await enquiries.updateOne(
        { _id, tenantId: session.tenantId },
        { $set: { "shortlist.$[other].outcome": "pending" } },
        { arrayFilters: [{ "other.id": { $ne: entryId }, "other.outcome": "picked" }] }
      );
    }

    const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: session.sub };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) set[`shortlist.$[target].${key}`] = value;
    }

    const result = await enquiries.findOneAndUpdate(
      { _id, tenantId: session.tenantId },
      { $set: set },
      { arrayFilters: [{ "target.id": entryId }], returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Enquiry");
    return NextResponse.json({ data: serialize(result) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id, entryId } = await params;

    const enquiries = await enquiriesCol();
    const result = await enquiries.findOneAndUpdate(
      { _id: toObjectId(id), tenantId: session.tenantId },
      {
        $pull: { shortlist: { id: entryId } },
        $set: { updatedAt: new Date(), updatedBy: session.sub },
      },
      { returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Enquiry");
    return NextResponse.json({ data: serialize(result) });
  });
}
