import { NextRequest, NextResponse } from "next/server";
import type { Filter } from "mongodb";
import { requireSession } from "@/lib/session";
import { enquiriesCol, brandsCol, contactsCol, type EnquiryMongo } from "@/lib/db/collections";
import { serialize, serializeAll } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { nextEnquiryCode } from "@/lib/codes";
import { enquiryCreateSchema } from "@/lib/validation/enquiry";
import { ENQUIRY_STATUSES } from "@/lib/enums";
import { toObjectId } from "@/lib/db/objectId";
import { BadRequestError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { searchParams } = request.nextUrl;

    const filter: Filter<EnquiryMongo> = { tenantId: session.tenantId };

    const status = searchParams.get("status");
    if (status) filter.status = status as EnquiryMongo["status"];

    const ownerId = searchParams.get("ownerId");
    if (ownerId) filter.ownerId = ownerId;

    const city = searchParams.get("city");
    if (city) filter["brief.city"] = city;

    const source = searchParams.get("source") as EnquiryMongo["source"] | null;
    if (source) filter.source = source;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      filter.createdAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      };
    }

    const q = searchParams.get("q");
    if (q) {
      filter.$or = [
        { code: { $regex: q, $options: "i" } },
        { "brief.rawText": { $regex: q, $options: "i" } },
      ];
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const enquiries = await enquiriesCol();
    const [docs, total] = await Promise.all([
      enquiries
        .find(filter)
        .sort({ nextActionDate: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      enquiries.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: serializeAll(docs),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const session = await requireSession();
    const body = await parseJson(request);
    const input = enquiryCreateSchema.parse(body);

    if (input.brandId) {
      const brands = await brandsCol();
      const brand = await brands.findOne({ _id: toObjectId(input.brandId), tenantId: session.tenantId });
      if (!brand) throw new BadRequestError("brandId does not reference an existing brand");
    }
    if (input.contactId) {
      const contacts = await contactsCol();
      const contact = await contacts.findOne({
        _id: toObjectId(input.contactId),
        tenantId: session.tenantId,
      });
      if (!contact) throw new BadRequestError("contactId does not reference an existing contact");
    }

    const now = new Date();
    const code = await nextEnquiryCode(now);

    const enquiries = await enquiriesCol();
    const doc: Omit<EnquiryMongo, "_id"> = {
      tenantId: session.tenantId,
      code,
      brandId: input.brandId ?? null,
      contactId: input.contactId ?? null,
      source: input.source,
      sourceDetail: input.sourceDetail ?? null,
      brief: input.brief,
      status: ENQUIRY_STATUSES[0], // "new"
      shortlist: [],
      outcome: { result: null, lossReason: null, lossNote: null, competitorName: null, closedAt: null },
      booking: {
        platformBookingId: null,
        offPlatform: false,
        studioId: null,
        grossValue: null,
        commissionValue: null,
        currency: "INR",
      },
      schedule: { originalShootDate: null, currentShootDate: null, endDate: null, delayEvents: [] },
      feedback: {},
      ownerId: input.ownerId ?? session.sub,
      nextActionDate: input.nextActionDate ?? null,
      nextActionReason: input.nextActionReason ?? null,
      lastContactedAt: null,
      firstResponseAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: session.sub,
      updatedBy: session.sub,
    };

    const result = await enquiries.insertOne(doc as EnquiryMongo);
    return NextResponse.json({ data: serialize({ _id: result.insertedId, ...doc }) }, { status: 201 });
  });
}
