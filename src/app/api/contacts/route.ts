import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { contactsCol, type ContactMongo } from "@/lib/db/collections";
import { serialize, serializeAll } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { contactCreateSchema } from "@/lib/validation/contact";
import { normalizePhone } from "@/lib/phone";
import { BadRequestError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q");
    const brandId = searchParams.get("brandId");

    const filter: Record<string, unknown> = { tenantId: session.tenantId };
    if (brandId) filter.brandId = brandId;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const contacts = await contactsCol();
    const docs = await contacts.find(filter).sort({ name: 1 }).limit(200).toArray();
    return NextResponse.json({ data: serializeAll(docs) });
  });
}

/**
 * `phone` is the dedupe key (spec §3.3): look up by normalised phone
 * before inserting. If a contact with this phone already exists for the
 * tenant, return it instead of creating a duplicate.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const body = await parseJson(request);
    const input = contactCreateSchema.parse(body);

    const normalizedPhone = normalizePhone(input.phone);
    if (!normalizedPhone) throw new BadRequestError("phone could not be normalized to E.164");
    const normalizedWhatsapp = input.whatsappNumber ? normalizePhone(input.whatsappNumber) : normalizedPhone;

    const contacts = await contactsCol();
    const existing = await contacts.findOne({ tenantId: session.tenantId, phone: normalizedPhone });
    if (existing) {
      return NextResponse.json({ data: serialize(existing), deduped: true });
    }

    const now = new Date();
    const doc: Omit<ContactMongo, "_id"> = {
      tenantId: session.tenantId,
      brandId: input.brandId ?? null,
      name: input.name,
      isCustomer: false,
      phone: normalizedPhone,
      whatsappNumber: normalizedWhatsapp ?? normalizedPhone,
      email: input.email ?? null,
      instagramHandle: input.instagramHandle ?? null,
      role: input.role ?? null,
      isPrimary: input.isPrimary ?? false,
      createdAt: now,
      updatedAt: now,
      createdBy: session.sub,
      updatedBy: session.sub,
    };
    const result = await contacts.insertOne(doc as ContactMongo);
    return NextResponse.json({ data: serialize({ _id: result.insertedId, ...doc }) }, { status: 201 });
  });
}
