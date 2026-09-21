import { NextRequest, NextResponse } from "next/server";
import type { Filter } from "mongodb";
import { requireSession } from "@/lib/session";
import { studiosCol, type StudioMongo } from "@/lib/db/collections";
import { serialize, serializeAll } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { studioCreateSchema } from "@/lib/validation/studio";
import { normalizePhone } from "@/lib/phone";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { searchParams } = request.nextUrl;

    const filter: Filter<StudioMongo> = { tenantId: session.tenantId };
    const stage = searchParams.get("stage");
    if (stage) filter.stage = stage as StudioMongo["stage"];
    const city = searchParams.get("city");
    if (city) filter.city = city;
    const tier = searchParams.get("tier");
    if (tier) filter.tier = tier as StudioMongo["tier"];
    const q = searchParams.get("q");
    if (q) filter.name = { $regex: q, $options: "i" };

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const studios = await studiosCol();
    const [docs, total] = await Promise.all([
      studios
        .find(filter)
        .sort({ nextActionDate: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      studios.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: serializeAll(docs),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const body = await parseJson(request);
    const input = studioCreateSchema.parse(body);

    const now = new Date();
    const studios = await studiosCol();
    const doc: Omit<StudioMongo, "_id"> = {
      tenantId: session.tenantId,
      ...input,
      // Best-effort E.164 normalization so WhatsApp deep links (spec §6)
      // work — lenient (keeps the raw value if it can't be normalized)
      // since studio contacts aren't the dedupe-critical collection contacts[] is.
      contacts: input.contacts.map((c) => ({ ...c, phone: normalizePhone(c.phone) ?? c.phone })),
      stage: "lead",
      lastContactedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: session.sub,
      updatedBy: session.sub,
    };
    const result = await studios.insertOne(doc as StudioMongo);
    return NextResponse.json({ data: serialize({ _id: result.insertedId, ...doc }) }, { status: 201 });
  });
}
