import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { enquiriesCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { delayUpdateSchema } from "@/lib/validation/enquiry";
import { assertValidTransition } from "@/lib/stateMachine/enquiryStatus";
import { writeStatusChangeActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string; delayId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id, delayId } = await params;
    const body = await parseJson(request);
    const input = delayUpdateSchema.parse(body);

    const enquiries = await enquiriesCol();
    const _id = toObjectId(id);
    const enquiry = await enquiries.findOne({ _id, tenantId: session.tenantId });
    if (!enquiry) throw new NotFoundError("Enquiry");
    if (!enquiry.schedule.delayEvents.some((event) => event.id === delayId)) {
      throw new NotFoundError("Delay event");
    }

    const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: session.sub };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) set[`schedule.delayEvents.$[target].${key}`] = value;
    }
    // A newDate resolves the delay by definition.
    if (input.newDate) {
      set["schedule.delayEvents.$[target].resolved"] = true;
      set["schedule.currentShootDate"] = input.newDate;
    }

    // Leaving "delayed" requires either a newDate (-> scheduled) — the
    // cancellation branch (-> lost) goes through the status endpoint
    // instead (spec §4.1).
    let statusChangedTo: string | null = null;
    if (enquiry.status === "delayed" && input.newDate) {
      const { set: statusSet } = assertValidTransition(
        enquiry,
        "scheduled",
        { to: "scheduled", note: input.note ?? null, currentShootDate: input.newDate }
      );
      Object.assign(set, statusSet);
      statusChangedTo = "scheduled";
    }

    const result = await enquiries.findOneAndUpdate(
      { _id, tenantId: session.tenantId },
      { $set: set },
      { arrayFilters: [{ "target.id": delayId }], returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Enquiry");

    if (statusChangedTo) {
      await writeStatusChangeActivity({
        tenantId: session.tenantId,
        entityType: "enquiry",
        entityId: id,
        from: enquiry.status,
        to: statusChangedTo,
        note: input.note ?? "Rescheduled",
        createdBy: session.sub,
      });
    }

    return NextResponse.json({ data: serialize(result) });
  });
}
