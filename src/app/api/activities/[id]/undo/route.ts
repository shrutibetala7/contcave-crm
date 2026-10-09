import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { serialize } from "@/lib/db/serialize";
import { handleRoute } from "@/lib/api/respond";
import { undoActivity } from "@/lib/enquiryActions";

type Params = { params: Promise<{ id: string }> };

/** Undo the workflow action this activity recorded (see undoActivity for the limits). */
export async function POST(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const enquiry = await undoActivity(session.tenantId, id, session.sub);
    return NextResponse.json({ data: serialize(enquiry) });
  });
}
