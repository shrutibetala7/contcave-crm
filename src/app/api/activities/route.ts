import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { activitiesCol, type ActivityMongo } from "@/lib/db/collections";
import { serialize, serializeAll } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { activityCreateSchema } from "@/lib/validation/activity";
import { BadRequestError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { searchParams } = request.nextUrl;
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    if (!entityType || !entityId) {
      throw new BadRequestError("entityType and entityId are required");
    }

    const activities = await activitiesCol();
    const docs = await activities
      .find({ tenantId: session.tenantId, entityType: entityType as ActivityMongo["entityType"], entityId })
      .sort({ occurredAt: -1 })
      .limit(200)
      .toArray();
    return NextResponse.json({ data: serializeAll(docs) });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const body = await parseJson(request);
    const input = activityCreateSchema.parse(body);

    const now = new Date();
    const activities = await activitiesCol();
    const doc: Omit<ActivityMongo, "_id"> = {
      tenantId: session.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      type: input.type,
      direction: input.direction ?? null,
      body: input.body ?? null,
      occurredAt: input.occurredAt ?? now,
      createdBy: session.sub,
      meta: input.meta ?? null,
      createdAt: now,
    };
    const result = await activities.insertOne(doc as ActivityMongo);
    return NextResponse.json({ data: serialize({ _id: result.insertedId, ...doc }) }, { status: 201 });
  });
}
