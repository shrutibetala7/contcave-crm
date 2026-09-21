import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { brandsCol, contactsCol, studiosCol, enquiriesCol } from "@/lib/db/collections";
import { serializeAll } from "@/lib/db/serialize";
import { handleRoute } from "@/lib/api/respond";

const LIMIT = 8;

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json({ brands: [], contacts: [], studios: [], enquiries: [] });
    }
    const rx = { $regex: q, $options: "i" };

    const [brands, contacts, studios, enquiries] = await Promise.all([
      brandsCol().then((c) => c.find({ tenantId: session.tenantId, name: rx }).limit(LIMIT).toArray()),
      contactsCol().then((c) =>
        c.find({ tenantId: session.tenantId, $or: [{ name: rx }, { phone: rx }] }).limit(LIMIT).toArray()
      ),
      studiosCol().then((c) => c.find({ tenantId: session.tenantId, name: rx }).limit(LIMIT).toArray()),
      enquiriesCol().then((c) =>
        c
          .find({ tenantId: session.tenantId, $or: [{ code: rx }, { "brief.rawText": rx }] })
          .limit(LIMIT)
          .toArray()
      ),
    ]);

    return NextResponse.json({
      brands: serializeAll(brands),
      contacts: serializeAll(contacts),
      studios: serializeAll(studios),
      enquiries: serializeAll(enquiries),
    });
  });
}
