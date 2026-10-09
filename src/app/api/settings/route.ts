import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { TransitionError } from "@/lib/stateMachine/errors";
import { workflowSettingsSchema } from "@/lib/validation/settings";
import { getWorkflowSettings, saveWorkflowSettings } from "@/lib/settings";

export async function GET() {
  return handleRoute(async () => {
    const session = await requireSession();
    return NextResponse.json({ data: await getWorkflowSettings(session.tenantId) });
  });
}

export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    if (session.role !== "admin") throw new TransitionError("Only an admin can change settings.");
    const input = workflowSettingsSchema.parse(await parseJson(request));
    await saveWorkflowSettings(session.tenantId, input, session.sub);
    return NextResponse.json({ data: input });
  });
}
