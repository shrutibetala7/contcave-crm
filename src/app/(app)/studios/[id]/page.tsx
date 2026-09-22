import { notFound } from "next/navigation";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { requireSession } from "@/lib/session";
import { studiosCol, activitiesCol } from "@/lib/db/collections";
import { serialize, serializeAll } from "@/lib/db/serialize";
import { toClientSafe } from "@/lib/serializeForClient";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { StageControl } from "@/components/studios/StageControl";
import { StudioDetails } from "@/components/studios/StudioDetails";
import { OnboardingChecklist } from "@/components/studios/OnboardingChecklist";

export default async function StudioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  if (!ObjectId.isValid(id)) notFound();

  const studios = await studiosCol();
  const doc = await studios.findOne({ _id: new ObjectId(id), tenantId: session.tenantId });
  if (!doc) notFound();

  const studio = serialize(doc);

  const activityDocs = await (await activitiesCol())
    .find({ tenantId: session.tenantId, entityType: "studio", entityId: id })
    .sort({ occurredAt: -1 })
    .limit(200)
    .toArray();
  const activities = serializeAll(activityDocs);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Link href="/studios" className="link-quiet -ml-1 inline-flex items-center gap-1 rounded px-1 py-1 text-xs">
          <Icon name="left" className="size-3.5" /> Studios
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{studio.name}</h1>
          <StatusBadge status={studio.stage} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <StudioDetails
            studioId={studio.id}
            name={studio.name}
            city={studio.city}
            locality={studio.locality}
            categories={studio.categories}
            notes={studio.notes}
            contacts={studio.contacts}
            contcaveUrl={studio.contcaveUrl}
          />
          <ActivityTimeline entityType="studio" entityId={studio.id} activities={toClientSafe(activities)} />
        </div>
        <div className="order-first space-y-4 lg:order-none">
          <StageControl studioId={studio.id} currentStage={studio.stage} />
          <OnboardingChecklist studioId={studio.id} onboarding={studio.onboarding} />
        </div>
      </div>
    </div>
  );
}
