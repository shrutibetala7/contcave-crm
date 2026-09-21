import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { contactsCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { NotFoundError, BadRequestError } from "@/lib/api/errors";
import { contactUpdateSchema } from "@/lib/validation/contact";
import { normalizePhone } from "@/lib/phone";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const contacts = await contactsCol();
    const doc = await contacts.findOne({ _id: toObjectId(id), tenantId: session.tenantId });
    if (!doc) throw new NotFoundError("Contact");
    return NextResponse.json({ data: serialize(doc) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const body = await parseJson(request);
    const input = contactUpdateSchema.parse(body);

    const set: Record<string, unknown> = { ...input, updatedAt: new Date(), updatedBy: session.sub };
    if (input.phone) {
      const normalized = normalizePhone(input.phone);
      if (!normalized) throw new BadRequestError("phone could not be normalized to E.164");
      set.phone = normalized;
    }
    if (input.whatsappNumber) {
      const normalized = normalizePhone(input.whatsappNumber);
      if (!normalized) throw new BadRequestError("whatsappNumber could not be normalized to E.164");
      set.whatsappNumber = normalized;
    }

    const contacts = await contactsCol();
    const result = await contacts.findOneAndUpdate(
      { _id: toObjectId(id), tenantId: session.tenantId },
      { $set: set },
      { returnDocument: "after" }
    );
    if (!result) throw new NotFoundError("Contact");
    return NextResponse.json({ data: serialize(result) });
  });
}
