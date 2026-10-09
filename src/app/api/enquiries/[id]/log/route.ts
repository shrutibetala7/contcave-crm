import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { serialize } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { logUpdateSchema } from "@/lib/validation/enquiry";
import { planLogUpdate } from "@/lib/workflow";
import { applyPlan, loadForWorkflow } from "@/lib/enquiryActions";
import { getWorkflowSettings } from "@/lib/settings";

type Params = { params: Promise<{ id: string }> };

/** Log update: record what happened; the stage and next follow-up follow from it. */
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const input = logUpdateSchema.parse(await parseJson(request));
    const [{ doc, wf }, settings] = await Promise.all([loadForWorkflow(session.tenantId, id), getWorkflowSettings(session.tenantId)]);
    const now = new Date();
    const plan = planLogUpdate(wf, input, settings, { now, userId: session.sub });
    const { enquiry, activityId } = await applyPlan({ tenantId: session.tenantId, doc, plan, userId: session.sub, now });
    return NextResponse.json({ data: serialize(enquiry), activityId, message: plan.activity.body });
  });
}
