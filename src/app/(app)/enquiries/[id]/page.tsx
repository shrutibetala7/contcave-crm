import { notFound } from "next/navigation";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { requireSession } from "@/lib/session";
import { enquiriesCol, brandsCol, contactsCol, studiosCol, activitiesCol } from "@/lib/db/collections";
import { serialize, serializeAll } from "@/lib/db/serialize";
import { toClientSafe } from "@/lib/serializeForClient";
import { listUsers } from "@/lib/users";
import { Icon } from "@/components/Icon";
import { BRAND_CATEGORY_LABELS } from "@/lib/enums";
import { StatusBadge } from "@/components/StatusBadge";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { NextActionPanel } from "@/components/NextActionPanel";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { BriefPanel } from "@/components/enquiries/BriefPanel";
import { StatusControl } from "@/components/enquiries/StatusControl";
import { ShortlistTable } from "@/components/enquiries/ShortlistTable";
import { DelayLog } from "@/components/enquiries/DelayLog";
import { BookingPanel } from "@/components/enquiries/BookingPanel";
import { FeedbackPanel } from "@/components/enquiries/FeedbackPanel";
import { DeleteEnquiryButton } from "@/components/enquiries/DeleteEnquiryButton";

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  if (!ObjectId.isValid(id)) notFound();

  const enquiries = await enquiriesCol();
  const doc = await enquiries.findOne({ _id: new ObjectId(id), tenantId: session.tenantId });
  if (!doc) notFound();

  const enquiry = serialize(doc);

  const [brand, contact, activityDocs, studioDocs, users] = await Promise.all([
    doc.brandId
      ? (await brandsCol()).findOne({ _id: new ObjectId(doc.brandId), tenantId: session.tenantId })
      : null,
    doc.contactId
      ? (await contactsCol()).findOne({ _id: new ObjectId(doc.contactId), tenantId: session.tenantId })
      : null,
    (await activitiesCol())
      .find({ tenantId: session.tenantId, entityType: "enquiry", entityId: id })
      .sort({ occurredAt: -1 })
      .limit(200)
      .toArray(),
    (await studiosCol()).find({ tenantId: session.tenantId }).limit(300).toArray(),
    listUsers(session.tenantId),
  ]);

  const activities = serializeAll(activityDocs);
  const studioOptions = studioDocs.map((s) => ({ id: s._id.toHexString(), name: s.name }));

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Link href="/enquiries" className="link-quiet -ml-1 inline-flex items-center gap-1 rounded px-1 py-1 text-xs">
          <Icon name="left" className="size-3.5" /> Enquiries
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{brand?.name ?? contact?.name ?? enquiry.code}</h1>
          <StatusBadge status={enquiry.status} />
          {contact?.isCustomer && (
            <span className="rounded-full border border-green-300 px-2 py-0.5 text-xs font-medium text-green-800">
              Customer
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
          <span className="tabular-nums">{enquiry.code}</span>
          {brand && contact && (
            <>
              <span aria-hidden>·</span>
              <span>{contact.name}</span>
            </>
          )}
          {!brand && enquiry.industry && (
            <>
              <span aria-hidden>·</span>
              <span className="capitalize">{BRAND_CATEGORY_LABELS[enquiry.industry]}</span>
            </>
          )}
          {contact && <WhatsAppLink phone={contact.whatsappNumber} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <BriefPanel
            enquiryId={enquiry.id}
            enquiryDate={enquiry.enquiryDate ? new Date(enquiry.enquiryDate).toISOString() : null}
            brief={toClientSafe(enquiry.brief)}
          />
          <ShortlistTable
            enquiryId={enquiry.id}
            shortlist={toClientSafe(enquiry.shortlist)}
            studioOptions={studioOptions}
          />
          <DelayLog enquiryId={enquiry.id} delayEvents={toClientSafe(enquiry.schedule.delayEvents)} />
          <FeedbackPanel enquiryId={enquiry.id} feedback={toClientSafe(enquiry.feedback)} />
          <ActivityTimeline entityType="enquiry" entityId={enquiry.id} activities={toClientSafe(activities)} />
        </div>
        <div className="order-first space-y-4 lg:order-none">
          <StatusControl enquiryId={enquiry.id} currentStatus={enquiry.status} />
          <NextActionPanel
            entityUrl={`/api/enquiries/${enquiry.id}`}
            ownerId={enquiry.ownerId ?? null}
            nextActionDate={enquiry.nextActionDate ? new Date(enquiry.nextActionDate).toISOString() : null}
            nextActionReason={enquiry.nextActionReason ?? null}
            users={users}
          />
          {/* Always shown — Confirmed can be reached in one step from any early
              status, and its guard needs this card's data to be fillable before then. */}
          <BookingPanel enquiryId={enquiry.id} booking={enquiry.booking} />
          {enquiry.outcome.result && (
            <div className="card p-4 text-sm">
              <h3 className="card-title mb-1">Outcome</h3>
              <p className="capitalize text-neutral-800">{enquiry.outcome.result}</p>
              {enquiry.outcome.lossReason && (
                <p className="text-xs text-neutral-500">Reason: {enquiry.outcome.lossReason.replace(/_/g, " ")}</p>
              )}
              {enquiry.outcome.lossNote && <p className="text-xs text-neutral-500">{enquiry.outcome.lossNote}</p>}
              {enquiry.outcome.cancelReason && (
                <p className="text-xs text-neutral-500">Reason: {enquiry.outcome.cancelReason.replace(/_/g, " ")}</p>
              )}
              {enquiry.outcome.cancelNote && <p className="text-xs text-neutral-500">{enquiry.outcome.cancelNote}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="pt-2">
        <DeleteEnquiryButton enquiryId={enquiry.id} code={enquiry.code} />
      </div>
    </div>
  );
}
