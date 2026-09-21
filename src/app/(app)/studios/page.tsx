import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { studiosCol } from "@/lib/db/collections";
import { serializeAll } from "@/lib/db/serialize";
import { StudiosFilters } from "@/components/studios/StudiosFilters";
import { StudioTable } from "@/components/studios/StudioTable";
import { NewStudioButton } from "@/components/studios/NewStudioButton";
import { parseSortParam } from "@/lib/listQuery";
import type { StudioStage } from "@/lib/enums";

export const metadata: Metadata = { title: "Studios" };

const SORTABLE_FIELDS = ["nextActionDate", "name"] as const;

export default async function StudiosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const filter: Record<string, unknown> = { tenantId: session.tenantId };
  if (sp.stage) filter.stage = sp.stage as StudioStage;
  if (sp.city) filter.city = { $regex: sp.city, $options: "i" };
  if (sp.q) filter.name = { $regex: sp.q, $options: "i" };
  const hasFilters = Boolean(sp.stage || sp.city || sp.q);

  const sort = parseSortParam(sp.sort, SORTABLE_FIELDS, { nextActionDate: 1, name: 1 });

  const studios = await studiosCol();
  const docs = await studios.find(filter).sort(sort).limit(200).toArray();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Studios</h1>
          <span className="text-sm tabular-nums text-neutral-500">
            {docs.length} {hasFilters ? "matching" : "total"}
          </span>
        </div>
        <NewStudioButton />
      </div>
      <StudiosFilters />
      <StudioTable studios={serializeAll(docs)} hasFilters={hasFilters} />
    </div>
  );
}
