import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { handleRoute } from "@/lib/api/respond";
import { getDueItems, getMetrics } from "@/lib/dashboardToday";

export async function GET() {
  return handleRoute(async () => {
    const session = await requireSession();
    const [due, metrics] = await Promise.all([
      getDueItems(session.tenantId),
      getMetrics(session.tenantId),
    ]);

    return NextResponse.json({
      overdue: due.overdue,
      today: due.today,
      thisWeek: due.thisWeek,
      newUnactioned: due.newUnactioned,
      counts: {
        overdue: due.overdue.length,
        today: due.today.length,
        thisWeek: due.thisWeek.length,
        newUnactioned: due.newUnactioned.length,
      },
      metrics,
    });
  });
}
