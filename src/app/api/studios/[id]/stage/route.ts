import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { studiosCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { studioStageChangeSchema } from "@/lib/validation/studio";
import { assertValidStageTransition } from "@/lib/stateMachine/studioStage";
import { writeStatusChangeActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const body = await parseJson(request);
    const input = studioStageChangeSchema.parse(body);

    const studios = await studiosCol();
    const _id = toObjectId(id);
    const studio = await studios.findOne({ _id, tenantId: session.tenantId });
    if (!studio) throw new NotFoundError("Studio");

    assertValidStageTransition(studio, input.to);

    const result = await studios.findOneAndUpdate(
      { _id, tenantId: session.tenantId },
      { $set: { stage: input.to, updatedAt: new Date(), updatedBy: session.sub } },
      { returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Studio");

    await writeStatusChangeActivity({
      tenantId: session.tenantId,
      entityType: "studio",
      entityId: id,
      from: studio.stage,
      to: input.to,
      note: input.note,
      createdBy: session.sub,
    });

    return NextResponse.json({ data: serialize(result) });
  });
}
