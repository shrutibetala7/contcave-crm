import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { serialize } from "@/lib/db/serialize";
import { handleRoute } from "@/lib/api/respond";
import { planFollowUpDone } from "@/lib/workflow";
import { applyPlan, loadForWorkflow } from "@/lib/enquiryActions";

type Params = { params: Promise<{ id: string }> };

/** Tick off a task follow-up (confirm timings, send feedback, collect commission); the next in the chain takes its place. */
export async function POST(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const { doc, wf } = await loadForWorkflow(session.tenantId, id);
    const now = new Date();
    const plan = planFollowUpDone(wf, { now, userId: session.sub });
    const { enquiry, activityId } = await applyPlan({ tenantId: session.tenantId, doc, plan, userId: session.sub, now });
    return NextResponse.json({ data: serialize(enquiry), activityId, message: plan.activity.body });
  });
}
