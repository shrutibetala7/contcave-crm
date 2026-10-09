import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { serialize } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { bookStudioSchema } from "@/lib/validation/enquiry";
import { planBooking } from "@/lib/workflow";
import { applyPlan, loadForWorkflow } from "@/lib/enquiryActions";

type Params = { params: Promise<{ id: string }> };

/**
 * Book one of the offered studios in one step: the chosen studio becomes the
 * only picked one, the booking and shoot date are recorded, the enquiry is
 * Confirmed, and its follow-up becomes "confirm timings" the day before.
 *
 * On an enquiry that's already Confirmed or Done it just updates the booking
 * (a changed value, date or studio) without touching the stage. A shoot date
 * already in the past is fine: it moves to Done on the next page load, which
 * is how an old booking is back-filled.
 */
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const input = bookStudioSchema.parse(await parseJson(request));
    const { doc, wf } = await loadForWorkflow(session.tenantId, id);
    const now = new Date();
    const plan = planBooking(
      wf,
      {
        chosenId: input.shortlistEntryId,
        grossValue: input.grossValue,
        platformBookingId: input.platformBookingId || null,
        shootDates: input.shootDates,
      },
      { now, userId: session.sub }
    );
    const { enquiry, activityId } = await applyPlan({ tenantId: session.tenantId, doc, plan, userId: session.sub, now, undoable: false });
    return NextResponse.json({ data: serialize(enquiry), activityId, message: plan.activity.body });
  });
}
