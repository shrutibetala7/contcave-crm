import { notFound } from "next/navigation";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { requireSession } from "@/lib/session";
import { enquiriesCol, brandsCol, contactsCol, studiosCol, activitiesCol } from "@/lib/db/collections";
import { serialize, serializeAll } from "@/lib/db/serialize";
import { toClientSafe } from "@/lib/serializeForClient";
import { listUsers } from "@/lib/users";
import { Icon } from "@/components/Icon";
import { completeFinishedShoots } from "@/lib/completeFinishedShoots";
import { enquiryDisplayName } from "@/lib/enquiryDisplayName";
import { StatusBadge } from "@/components/StatusBadge";
import { ContactLinks } from "@/components/ContactLinks";
import { PhoneNumber } from "@/components/PhoneNumber";
import { LOSS_REASON_LABELS } from "@/lib/enums";
import { BACKFILL_LABEL, isBackfilled } from "@/lib/backfill";
import { NextActionPanel } from "@/components/NextActionPanel";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { BriefPanel } from "@/components/enquiries/BriefPanel";
import { StatusControl } from "@/components/enquiries/StatusControl";
import { StudiosAndBooking } from "@/components/enquiries/StudiosAndBooking";
import { DelayLog } from "@/components/enquiries/DelayLog";
import { FeedbackPanel } from "@/components/enquiries/FeedbackPanel";
import { DeleteEnquiryButton } from "@/components/enquiries/DeleteEnquiryButton";

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  if (!ObjectId.isValid(id)) notFound();

  // Opened straight from a link after the shoot? Show it as Completed, not Confirmed.
  await completeFinishedShoots(session.tenantId);

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
  const { title: heading, subtitle: subheading } = enquiryDisplayName({
    code: enquiry.code,
    contactName: contact?.name,
    brandName: brand?.name,
    instagramHandle: contact?.instagramHandle,
    phone: contact?.phone,
    industry: enquiry.industry ?? null,
  });
  const studioOptions = studioDocs
    .map((s) => ({ id: s._id.toHexString(), name: s.name, area: [s.locality, s.city].filter(Boolean).join(", ") || null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Delays only happen to a booked shoot, and feedback only after one — show
  // each once it applies, or whenever it already holds something.
  const hasBooking = enquiry.shortlist.some((s) => s.outcome === "picked");
  const showDelayLog = hasBooking || enquiry.schedule.delayEvents.length > 0;
  const showFeedback = enquiry.status === "completed" || Boolean(enquiry.feedback.client || enquiry.feedback.studio);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Link href="/enquiries" className="link-quiet -ml-1 inline-flex items-center gap-1 rounded px-1 py-1 text-xs">
          <Icon name="left" className="size-3.5" /> Enquiries
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{heading}</h1>
          <StatusBadge status={enquiry.status} />
          {contact?.isCustomer && (
            <span className="rounded-full border border-green-300 px-2 py-0.5 text-xs font-medium text-green-800">
              Customer
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
          {subheading && subheading !== enquiry.code && (
            <>
              <span>{subheading}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="tabular-nums">{enquiry.code}</span>
          {contact?.phone && (
            <>
              <span aria-hidden>·</span>
              <PhoneNumber phone={contact.phone} />
            </>
          )}
          {contact && (
            <>
              <span aria-hidden>·</span>
              <ContactLinks phone={contact.whatsappNumber ?? contact.phone} instagramHandle={contact.instagramHandle} />
            </>
          )}
        </div>
        {isBackfilled(enquiry.createdAt) && (
          <p className="mt-2 text-xs text-neutral-500">
            Entered in the {BACKFILL_LABEL} backfill — the status dates in its history are when it was typed in, not when
            things happened.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <BriefPanel
            enquiryId={enquiry.id}
            enquiryDate={enquiry.enquiryDate ? new Date(enquiry.enquiryDate).toISOString() : null}
            brief={toClientSafe(enquiry.brief)}
          />
          <StudiosAndBooking
            enquiryId={enquiry.id}
            status={enquiry.status}
            shortlist={toClientSafe(enquiry.shortlist)}
            booking={enquiry.booking}
            preferredDates={enquiry.brief.preferredDates.map((d) => new Date(d).toISOString())}
            studioOptions={studioOptions}
          />
          {showDelayLog && <DelayLog enquiryId={enquiry.id} delayEvents={toClientSafe(enquiry.schedule.delayEvents)} />}
          {showFeedback && <FeedbackPanel enquiryId={enquiry.id} feedback={toClientSafe(enquiry.feedback)} />}
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
          {/* A won booking is summarised in Studios & booking; this is for how it ended otherwise. */}
          {enquiry.outcome.result && enquiry.outcome.result !== "won" && (
            <div className="card p-4 text-sm">
              <h3 className="card-title mb-1">Outcome</h3>
              <p className="capitalize text-neutral-800">{enquiry.outcome.result}</p>
              {enquiry.outcome.lossReason && (
                <p className="text-xs text-neutral-500">Reason: {LOSS_REASON_LABELS[enquiry.outcome.lossReason]}</p>
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
