import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { contactsCol, type ContactMongo } from "@/lib/db/collections";
import { serialize, serializeAll } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { contactCreateSchema } from "@/lib/validation/contact";
import { normalizePhone } from "@/lib/phone";
import { normalizeInstagramHandle } from "@/lib/instagram";
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
        { instagramHandle: { $regex: q.replace(/^@/, ""), $options: "i" } },
      ];
    }

    const contacts = await contactsCol();
    const docs = await contacts.find(filter).sort({ name: 1 }).limit(200).toArray();
    return NextResponse.json({ data: serializeAll(docs) });
  });
}

/**
 * Dedupe before inserting (spec §3.3): by normalised phone when there is
 * one, otherwise by Instagram handle (a name alone isn't a safe match, so a
 * contact with neither is always new). A match is returned instead of a
 * duplicate, and picks up whichever of the two it was missing — so a lead
 * first saved from an Instagram DM gains their number when they later
 * WhatsApp us, and stays one contact.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const body = await parseJson(request);
    const input = contactCreateSchema.parse(body);

    const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
    if (input.phone?.trim() && !phone) {
      throw new BadRequestError("That phone number doesn't look right — use 10 digits, or include the country code.");
    }
    const instagramHandle = input.instagramHandle?.trim() ? normalizeInstagramHandle(input.instagramHandle) : null;
    if (input.instagramHandle?.trim() && !instagramHandle) {
      throw new BadRequestError("That Instagram handle doesn't look right — letters, numbers, dots and underscores only.");
    }
    const whatsappNumber = input.whatsappNumber ? normalizePhone(input.whatsappNumber) : phone;

    const contacts = await contactsCol();
    const keys = [...(phone ? [{ phone }] : []), ...(instagramHandle ? [{ instagramHandle }] : [])];
    const existing = keys.length === 0 ? null : await contacts.findOne({
      tenantId: session.tenantId,
      $or: keys,
    });
    if (existing) {
      const fill: Partial<ContactMongo> = {};
      if (phone && !existing.phone) Object.assign(fill, { phone, whatsappNumber: existing.whatsappNumber ?? whatsappNumber });
      if (instagramHandle && !existing.instagramHandle) fill.instagramHandle = instagramHandle;
      if (Object.keys(fill).length === 0) return NextResponse.json({ data: serialize(existing), deduped: true });
      const updated = await contacts.findOneAndUpdate(
        { _id: existing._id, tenantId: session.tenantId },
        { $set: { ...fill, updatedAt: new Date(), updatedBy: session.sub } },
        { returnDocument: "after" }
      );
      return NextResponse.json({ data: serialize(updated ?? existing), deduped: true });
    }

    const now = new Date();
    const doc: Omit<ContactMongo, "_id"> = {
      tenantId: session.tenantId,
      brandId: input.brandId ?? null,
      name: input.name,
      isCustomer: false,
      phone,
      whatsappNumber,
      email: input.email ?? null,
      instagramHandle,
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
