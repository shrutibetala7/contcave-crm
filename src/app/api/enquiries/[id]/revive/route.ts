import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { serialize } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { reviveSchema } from "@/lib/validation/enquiry";
import { planRevive } from "@/lib/workflow";
import { applyPlan, loadForWorkflow } from "@/lib/enquiryActions";

type Params = { params: Promise<{ id: string }> };

/** A parked lead is back in touch: Talking again, with a date to follow up. */
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const input = reviveSchema.parse(await parseJson(request));
    const { doc, wf } = await loadForWorkflow(session.tenantId, id);
    const now = new Date();
    const plan = planRevive(wf, input.followUpOn, { now, userId: session.sub }, input.note);
    const { enquiry, activityId } = await applyPlan({ tenantId: session.tenantId, doc, plan, userId: session.sub, now });
    return NextResponse.json({ data: serialize(enquiry), activityId, message: plan.activity.body });
  });
}
