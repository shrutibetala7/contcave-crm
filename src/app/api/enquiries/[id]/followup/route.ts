import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { serialize } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { rescheduleFollowUpSchema } from "@/lib/validation/enquiry";
import { planReschedule } from "@/lib/workflow";
import { applyPlan, loadForWorkflow } from "@/lib/enquiryActions";

type Params = { params: Promise<{ id: string }> };

/** Move the open follow-up to another day (and optionally reword it). */
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const input = rescheduleFollowUpSchema.parse(await parseJson(request));
    const { doc, wf } = await loadForWorkflow(session.tenantId, id);
    const now = new Date();
    const plan = planReschedule(wf, input.dueOn, input.label, { now, userId: session.sub });
    const { enquiry, activityId } = await applyPlan({ tenantId: session.tenantId, doc, plan, userId: session.sub, now });
    return NextResponse.json({ data: serialize(enquiry), activityId, message: plan.activity.body });
  });
}
