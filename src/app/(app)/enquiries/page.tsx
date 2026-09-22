import type { Metadata } from "next";
import { ObjectId } from "mongodb";
import { requireSession } from "@/lib/session";
import { enquiriesCol, contactsCol, brandsCol, type EnquiryMongo } from "@/lib/db/collections";
import { serializeAll } from "@/lib/db/serialize";
import { listUsers } from "@/lib/users";
import { EnquiriesFilters } from "@/components/enquiries/EnquiriesFilters";
import { EnquiryTable } from "@/components/enquiries/EnquiryTable";
import { parseSortParam } from "@/lib/listQuery";
import { buildEnquirySortPipeline } from "@/lib/enquirySort";
import type { EnquiryStatus, EnquirySource } from "@/lib/enums";

export const metadata: Metadata = { title: "Enquiries" };

const SORTABLE_FIELDS = ["nextActionDate", "createdAt", "code"] as const;
const LIMIT = 100;

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const filter: Record<string, unknown> = { tenantId: session.tenantId };
  if (sp.status) filter.status = sp.status as EnquiryStatus;
  // Change Brief v1.1 §C: query param is "owner" (matches the brief's example
  // URL), translated to the ownerId field only here at the Mongo filter.
  if (sp.owner) filter.ownerId = sp.owner;
  if (sp.city) filter["brief.city"] = sp.city;
  if (sp.source) filter.source = sp.source as EnquirySource;
  if (sp.q) {
    filter.$or = [
      { code: { $regex: sp.q, $options: "i" } },
      { "brief.rawText": { $regex: sp.q, $options: "i" } },
    ];
  }
  const hasFilters = Boolean(sp.status || sp.owner || sp.city || sp.source || sp.q);

  const enquiries = await enquiriesCol();

  // Default (and explicit "date"/"-date"): shoot date if one is set, else
  // enquiry date — soonest first. Any other value falls back to a plain field sort.
  const sortParam = sp.sort ?? "date";
  let docs: EnquiryMongo[];
  if (sortParam === "date" || sortParam === "-date") {
    const direction = sortParam.startsWith("-") ? -1 : 1;
    docs = await enquiries
      .aggregate<EnquiryMongo>(buildEnquirySortPipeline(filter, direction, LIMIT))
      .toArray();
  } else {
    const sort = parseSortParam(sp.sort, SORTABLE_FIELDS, { nextActionDate: 1, createdAt: -1 });
    docs = await enquiries.find(filter).sort(sort).limit(LIMIT).toArray();
  }
  const list = serializeAll(docs);

  const contactIds = Array.from(new Set(docs.map((d) => d.contactId).filter((v): v is string => Boolean(v))));
  const brandIds = Array.from(new Set(docs.map((d) => d.brandId).filter((v): v is string => Boolean(v))));
  const [contacts, brands, users] = await Promise.all([
    contactIds.length
      ? (await contactsCol())
          .find({ tenantId: session.tenantId, _id: { $in: contactIds.map((id) => new ObjectId(id)) } })
          .toArray()
      : [],
    brandIds.length
      ? (await brandsCol())
          .find({ tenantId: session.tenantId, _id: { $in: brandIds.map((id) => new ObjectId(id)) } })
          .toArray()
      : [],
    listUsers(session.tenantId),
  ]);
  const contactById = new Map(contacts.map((c) => [c._id.toHexString(), c]));
  const brandById = new Map(brands.map((b) => [b._id.toHexString(), b.name]));
  const userById = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Enquiries</h1>
        <span className="text-sm tabular-nums text-neutral-500">
          {list.length} {hasFilters ? "matching" : "total"}
        </span>
      </div>
      <EnquiriesFilters users={users} />
      <EnquiryTable
        enquiries={list}
        contactById={contactById}
        brandById={brandById}
        userById={userById}
        hasFilters={hasFilters}
      />
    </div>
  );
}
