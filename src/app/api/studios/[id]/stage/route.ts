import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { studiosCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { studioStageChangeSchema } from "@/lib/validation/studio";
import { writeStatusChangeActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

/**
 * A studio's status is just one of four values — no transition rules or
 * guards. Any status can be set from any other; the change is still logged
 * on the studio's timeline.
 */
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const { to } = studioStageChangeSchema.parse(await parseJson(request));

    const studios = await studiosCol();
    const _id = toObjectId(id);
    const studio = await studios.findOne({ _id, tenantId: session.tenantId });
    if (!studio) throw new NotFoundError("Studio");
    if (studio.stage === to) return NextResponse.json({ data: serialize(studio) });

    const result = await studios.findOneAndUpdate(
      { _id, tenantId: session.tenantId },
      { $set: { stage: to, updatedAt: new Date(), updatedBy: session.sub } },
      { returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Studio");

    await writeStatusChangeActivity({
      tenantId: session.tenantId,
      entityType: "studio",
      entityId: id,
      from: studio.stage,
      to,
      createdBy: session.sub,
    });

    return NextResponse.json({ data: serialize(result) });
  });
}
