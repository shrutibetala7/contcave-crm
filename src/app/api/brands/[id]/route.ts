import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { brandsCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { brandUpdateSchema } from "@/lib/validation/brand";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const brands = await brandsCol();
    const doc = await brands.findOne({ _id: toObjectId(id), tenantId: session.tenantId });
    if (!doc) throw new NotFoundError("Brand");
    return NextResponse.json({ data: serialize(doc) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const body = await parseJson(request);
    const input = brandUpdateSchema.parse(body);

    const brands = await brandsCol();
    const result = await brands.findOneAndUpdate(
      { _id: toObjectId(id), tenantId: session.tenantId },
      { $set: { ...input, updatedAt: new Date(), updatedBy: session.sub } },
      { returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Brand");
    return NextResponse.json({ data: serialize(result) });
  });
}
