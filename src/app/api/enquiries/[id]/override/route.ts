import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { serialize } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { TransitionError } from "@/lib/stateMachine/errors";
import { overrideStageSchema } from "@/lib/validation/enquiry";
import { planOverride } from "@/lib/workflow";
import { applyPlan, loadForWorkflow } from "@/lib/enquiryActions";

type Params = { params: Promise<{ id: string }> };

/** Admin only: set the stage directly. The reason goes on the timeline. */
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    if (session.role !== "admin") throw new TransitionError("Only an admin can override the stage.");
    const { id } = await params;
    const input = overrideStageSchema.parse(await parseJson(request));
    const { doc, wf } = await loadForWorkflow(session.tenantId, id);
    const now = new Date();
    const plan = planOverride(wf, input, { now, userId: session.sub });
    const { enquiry, activityId } = await applyPlan({ tenantId: session.tenantId, doc, plan, userId: session.sub, now });
    return NextResponse.json({ data: serialize(enquiry), activityId, message: plan.activity.body });
  });
}
