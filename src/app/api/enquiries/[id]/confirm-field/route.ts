import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { enquiriesCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError, BadRequestError } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

const confirmFieldSchema = z.object({ path: z.string().min(1) });

/**
 * Change Brief v1.1 §A: mark one brief.fieldEvidence entry confirmed.
 * Read-modify-write in application code rather than a Mongo dot-path
 * update — the map's own keys (e.g. "brief.shootType") contain literal
 * dots, which would collide with Mongo's dot-notation nesting if targeted
 * directly (`brief.fieldEvidence.brief.shootType` reads as four levels of
 * nesting, not "the fieldEvidence map's 'brief.shootType' key").
 */
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const body = await parseJson(request);
    const { path } = confirmFieldSchema.parse(body);

    const enquiries = await enquiriesCol();
    const _id = toObjectId(id);
    const enquiry = await enquiries.findOne({ _id, tenantId: session.tenantId });
    if (!enquiry) throw new NotFoundError("Enquiry");

    const existing = enquiry.brief.fieldEvidence?.[path];
    if (!existing) {
      throw new BadRequestError(`No fieldEvidence recorded for "${path}"`);
    }

    const updatedFieldEvidence = {
      ...enquiry.brief.fieldEvidence,
      [path]: { ...existing, confirmedBy: session.sub, confirmedAt: new Date() },
    };

    const result = await enquiries.findOneAndUpdate(
      { _id, tenantId: session.tenantId },
      {
        $set: {
          "brief.fieldEvidence": updatedFieldEvidence,
          updatedAt: new Date(),
          updatedBy: session.sub,
        },
      },
      { returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Enquiry");
    return NextResponse.json({ data: serialize(result) });
  });
}
