import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { enquiriesCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { delayCreateSchema } from "@/lib/validation/enquiry";
import { writeActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

/**
 * The delay log is independent of the enquiry's status — logging a delay
 * (or resolving one) never changes it. That decoupling is deliberate: the
 * status pipeline stayed simple (seven statuses, no forced order) precisely
 * so operational data like this doesn't need a status of its own to exist.
 */
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const body = await parseJson(request);
    const input = delayCreateSchema.parse(body);

    const enquiries = await enquiriesCol();
    const _id = toObjectId(id);
    const enquiry = await enquiries.findOne({ _id, tenantId: session.tenantId });
    if (!enquiry) throw new NotFoundError("Enquiry");

    const delayEvent = {
      id: new ObjectId().toHexString(),
      previousDate: input.previousDate,
      newDate: input.newDate ?? null,
      estimatedWindow: input.estimatedWindow ?? null,
      reason: input.reason,
      causedBy: input.causedBy,
      reportedAt: new Date(),
      followUpOn: input.followUpOn ?? null,
      followUpReason: input.followUpReason ?? null,
      resolved: input.newDate != null,
      note: input.note ?? null,
    };

    const result = await enquiries.findOneAndUpdate(
      { _id, tenantId: session.tenantId },
      {
        $push: { "schedule.delayEvents": delayEvent },
        $set: {
          "schedule.currentShootDate": input.newDate ?? null,
          updatedAt: new Date(),
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
      body: `Delay logged (${input.causedBy}): ${input.reason}`,
      createdBy: session.sub,
      meta: { delayEventId: delayEvent.id },
    });

    return NextResponse.json({ data: serialize(result) }, { status: 201 });
  });
}
