import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { enquiriesCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { delayCreateSchema } from "@/lib/validation/enquiry";
import { assertValidTransition } from "@/lib/stateMachine/enquiryStatus";
import { writeActivity, writeStatusChangeActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

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
      resolved: input.newDate != null,
      note: input.note ?? null,
    };

    const set: Record<string, unknown> = {
      "schedule.currentShootDate": input.newDate ?? null,
      updatedAt: new Date(),
      updatedBy: session.sub,
    };

    // Entering "delayed" requires a delay event to already exist (spec
    // §4.1) — check the guard against the enquiry state *with this event
    // included*, so a fresh "scheduled" enquiry can transition here.
    let statusChangedTo: string | null = null;
    if (enquiry.status === "scheduled") {
      const { set: statusSet } = assertValidTransition(
        { ...enquiry, schedule: { ...enquiry.schedule, delayEvents: [...enquiry.schedule.delayEvents, delayEvent] } },
        "delayed",
        { to: "delayed", note: input.reason }
      );
      Object.assign(set, statusSet);
      statusChangedTo = "delayed";
    }

    const result = await enquiries.findOneAndUpdate(
      { _id, tenantId: session.tenantId },
      { $push: { "schedule.delayEvents": delayEvent }, $set: set },
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
    if (statusChangedTo) {
      await writeStatusChangeActivity({
        tenantId: session.tenantId,
        entityType: "enquiry",
        entityId: id,
        from: enquiry.status,
        to: statusChangedTo,
        note: input.reason,
        createdBy: session.sub,
      });
    }

    return NextResponse.json({ data: serialize(result) }, { status: 201 });
  });
}
