import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { completeFinishedShoots } from "@/lib/completeFinishedShoots";
import { autoParkStaleLeads, FIRST_REPLY_TARGET_HOURS } from "@/lib/leadHygiene";
import { getPipeline } from "@/lib/pipeline";
import { getRevenueSummary } from "@/lib/revenue";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PipelineFilters } from "@/components/pipeline/PipelineFilters";
import { RevenueSummary } from "@/components/pipeline/RevenueSummary";
import { HoldingQueue } from "@/components/pipeline/HoldingQueue";

export const metadata: Metadata = { title: "Pipeline" };

/**
 * The home screen: every live lead, grouped by where it stands, with what's
 * due to be chased flagged on the card. The full searchable history is the
 * Enquiries page — this board is only for working what's open.
 */
export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  await completeFinishedShoots(session.tenantId);
  await autoParkStaleLeads(session.tenantId);
  const [{ columns, holding, users, counts }, revenue] = await Promise.all([
    getPipeline(session.tenantId, { ownerId: sp.owner || undefined }),
    getRevenueSummary(session.tenantId),
  ]);

  const due = counts.overdue + counts.dueToday;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Pipeline</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {counts.open} open
            {counts.overdue > 0 && (
              <>
                {" · "}
                <span className="font-medium text-red-700">{counts.overdue} overdue</span>
              </>
            )}
            {counts.dueToday > 0 && <> · {counts.dueToday} to chase today</>}
            {due === 0 && <> · nothing to chase today</>}
            {counts.awaitingReply > 0 && (
              <>
                {" · "}
                <span className="font-medium text-red-700">
                  {counts.awaitingReply} waiting over {FIRST_REPLY_TARGET_HOURS}h for a first reply
                </span>
              </>
            )}
          </p>
        </div>
        <PipelineFilters users={users} dueCount={due} />
      </header>

      <RevenueSummary summary={revenue} />

      {holding.length > 0 && <HoldingQueue cards={holding} />}

      <PipelineBoard columns={columns} />
    </div>
  );
}
