import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { studiosCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError } from "@/lib/api/errors";
import { studioUpdateSchema, type StudioUpdateInput } from "@/lib/validation/studio";
import { normalizePhone } from "@/lib/phone";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const studios = await studiosCol();
    const doc = await studios.findOne({ _id: toObjectId(id), tenantId: session.tenantId });
    if (!doc) throw new NotFoundError("Studio");
    return NextResponse.json({ data: serialize(doc) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const body = await parseJson(request);
    const input = studioUpdateSchema.parse(body);

    const studios = await studiosCol();
    const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: session.sub };
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (key === "onboarding" && value && typeof value === "object") {
        for (const [flagKey, flagValue] of Object.entries(value)) {
          if (flagValue !== undefined) set[`onboarding.${flagKey}`] = flagValue;
        }
        continue;
      }
      if (key === "agreement" && value && typeof value === "object") {
        for (const [aKey, aValue] of Object.entries(value)) {
          if (aValue !== undefined) set[`agreement.${aKey}`] = aValue;
        }
        continue;
      }
      if (key === "contacts" && Array.isArray(value)) {
        set.contacts = (value as NonNullable<StudioUpdateInput["contacts"]>).map((c) => ({
          ...c,
          phone: normalizePhone(c.phone) ?? c.phone,
        }));
        continue;
      }
      set[key] = value;
    }

    const result = await studios.findOneAndUpdate(
      { _id: toObjectId(id), tenantId: session.tenantId },
      { $set: set },
      { returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Studio");
    return NextResponse.json({ data: serialize(result) });
  });
}
