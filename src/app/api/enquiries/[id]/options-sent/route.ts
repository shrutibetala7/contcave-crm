import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { serialize } from "@/lib/db/serialize";
import { activitiesCol } from "@/lib/db/collections";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { optionsSentSchema } from "@/lib/validation/enquiry";
import { planOptionsSent } from "@/lib/workflow";
import { applyPlan, loadForWorkflow } from "@/lib/enquiryActions";
import { getWorkflowSettings } from "@/lib/settings";

type Params = { params: Promise<{ id: string }> };

/** The options message went to the client: stage moves to Options sent, check back in a day. */
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const input = optionsSentSchema.parse(await parseJson(request));
    const [{ doc, wf }, settings, lastSent] = await Promise.all([
      loadForWorkflow(session.tenantId, id),
      getWorkflowSettings(session.tenantId),
      activitiesCol().then((c) =>
        c.findOne({ tenantId: session.tenantId, entityType: "enquiry", entityId: id, type: "offer_sent" }, { sort: { occurredAt: -1 } })
      ),
    ]);
    // This message's offers: the ones added since options last went out.
    const since = lastSent ? new Date(lastSent.occurredAt).getTime() : 0;
    const sent = doc.shortlist.filter((s) => new Date(s.sentAt).getTime() > since);
    const now = new Date();
    const plan = planOptionsSent(wf, sent, settings, { now, userId: session.sub }, input.note);
    const { enquiry, activityId } = await applyPlan({ tenantId: session.tenantId, doc, plan, userId: session.sub, now });
    return NextResponse.json({ data: serialize(enquiry), activityId, message: plan.activity.body });
  });
}
