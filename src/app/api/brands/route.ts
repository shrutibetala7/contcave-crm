import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { brandsCol, type BrandMongo } from "@/lib/db/collections";
import { serialize, serializeAll } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { brandCreateSchema } from "@/lib/validation/brand";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q");

    const filter: Record<string, unknown> = { tenantId: session.tenantId };
    if (q) filter.name = { $regex: q, $options: "i" };

    const brands = await brandsCol();
    const docs = await brands.find(filter).sort({ name: 1 }).limit(200).toArray();
    return NextResponse.json({ data: serializeAll(docs) });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const body = await parseJson(request);
    const input = brandCreateSchema.parse(body);

    const now = new Date();
    const brands = await brandsCol();
    const doc: Omit<BrandMongo, "_id"> = {
      tenantId: session.tenantId,
      ...input,
      totalEnquiries: 0,
      totalWon: 0,
      lifetimeValue: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: session.sub,
      updatedBy: session.sub,
    };
    const result = await brands.insertOne(doc as BrandMongo);
    return NextResponse.json({ data: serialize({ _id: result.insertedId, ...doc }) }, { status: 201 });
  });
}
