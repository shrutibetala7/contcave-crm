import type { Metadata } from "next";
import { format } from "date-fns";
import { requireSession } from "@/lib/session";
import { getDueItems, getMetrics, TODAY_RANGES, type TodayRange } from "@/lib/dashboardToday";
import { listUsers } from "@/lib/users";
import { TodaySection } from "@/components/today/TodaySection";
import { TodayFilters } from "@/components/today/TodayFilters";

export const metadata: Metadata = { title: "Today" };

const RANGE_SECTION_TITLE: Record<TodayRange, string> = {
  week: "Coming up this week",
  "14d": "Coming up in 14 days",
  "30d": "Coming up in 30 days",
};

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const range: TodayRange = sp.range && sp.range in TODAY_RANGES ? (sp.range as TodayRange) : "week";
  const owner = sp.owner || undefined;

  const [due, metrics, users] = await Promise.all([
    getDueItems(session.tenantId, { ownerId: owner, range }),
    getMetrics(session.tenantId),
    listUsers(session.tenantId),
  ]);

  const summary =
    due.overdue.length + due.today.length === 0
      ? "Nothing overdue or due today."
      : [
          due.overdue.length ? `${due.overdue.length} overdue` : null,
          due.today.length ? `${due.today.length} due today` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="space-y-8 sm:pb-16">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Today</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {format(new Date(), "EEEE d MMMM")} · <span className={due.overdue.length ? "font-medium text-red-700" : ""}>{summary}</span>
          </p>
        </div>
        <TodayFilters users={users} />
      </header>

      <TodaySection title="Overdue" emphasis="danger" items={due.overdue} emptyText="Nothing overdue." />
      <TodaySection title="Due today" items={due.today} emptyText="Nothing due today." />
      <TodaySection title={RANGE_SECTION_TITLE[range]} items={due.thisWeek} emptyText="Nothing scheduled in this window." />
      <TodaySection
        title="New, not yet triaged"
        items={due.newUnactioned}
        emptyText="Every new enquiry has a next step."
      />

      <footer className="border-t border-neutral-200 bg-white sm:fixed sm:inset-x-0 sm:bottom-0 sm:z-20 sm:bg-white/95 sm:backdrop-blur">
        <dl className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-1 px-0 py-3 text-xs text-neutral-600 sm:px-4 sm:py-2">
          <div title="Share of enquiries older than 14 days that have a recorded outcome. Target 100%.">
            <dt className="inline">Outcome coverage (14d+): </dt>
            <dd className="inline font-semibold tabular-nums text-neutral-900">
              {metrics.outcomeCoveragePct == null ? "—" : `${metrics.outcomeCoveragePct}%`}
            </dd>
          </div>
          <div title="Median time from an enquiry arriving to the first reply.">
            <dt className="inline">Median first response: </dt>
            <dd className="inline font-semibold tabular-nums text-neutral-900">
              {metrics.medianFirstResponseHours == null ? "—" : `${metrics.medianFirstResponseHours}h`}
            </dd>
          </div>
          <div title="Enquiries that went dormant, were revived, and closed won.">
            <dt className="inline">Revived enquiries: </dt>
            <dd className="inline font-semibold tabular-nums text-neutral-900">{metrics.revivedCount}</dd>
          </div>
        </dl>
      </footer>
    </div>
  );
}
