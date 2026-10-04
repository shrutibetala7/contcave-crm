import { enquiriesCol, studiosCol } from "@/lib/db/collections";
import { marketFor } from "@/lib/cities";
import type { ShootType } from "@/lib/enums";

export interface StudioBookingStats {
  count: number;
  /** Last day of the most recent booked shoot. */
  lastShoot: Date | null;
}

/**
 * How much each studio is actually being booked. A studio's stage only says
 * it's onboarded; this says whether that has turned into shoots.
 */
export async function getStudioBookingStats(tenantId: string): Promise<Map<string, StudioBookingStats>> {
  const docs = await (await enquiriesCol())
    .find(
      { tenantId, status: { $in: ["confirmed", "completed"] }, "booking.studioId": { $ne: null } },
      { projection: { "booking.studioId": 1, "brief.preferredDates": 1 } }
    )
    .toArray();

  const stats = new Map<string, StudioBookingStats>();
  for (const e of docs) {
    const id = e.booking.studioId!;
    const s = stats.get(id) ?? { count: 0, lastShoot: null };
    s.count++;
    for (const d of e.brief?.preferredDates ?? []) {
      const date = new Date(d);
      if (!s.lastShoot || date > s.lastShoot) s.lastShoot = date;
    }
    stats.set(id, s);
  }
  return stats;
}

export interface MarketDemand {
  market: string;
  enquiries: number;
  booked: number;
  /** Lost or parked — demand we didn't turn into a booking. */
  unmet: number;
  /** Of those, lost/parked because there was no studio to offer. */
  noStudio: number;
  /** Verified or curated studios in this market. */
  studios: number;
  /** Shoot types among the unmet enquiries, most common first. */
  unmetShootTypes: { type: ShootType | "unknown"; count: number }[];
}

export const DEMAND_WINDOW_DAYS = 180;

/**
 * Enquiries by city against the studios we can offer there — where demand is
 * going unmet, and for what kind of shoot. It's the onboarding plan: a city
 * with leads and no studios is where the next studios should come from.
 */
export async function getDemandBySupply(tenantId: string): Promise<MarketDemand[]> {
  const since = new Date(Date.now() - DEMAND_WINDOW_DAYS * 86_400_000);
  const [enquiries, studios] = await Promise.all([
    (await enquiriesCol())
      .find(
        {
          tenantId,
          $or: [{ enquiryDate: { $gte: since } }, { enquiryDate: null, createdAt: { $gte: since } }],
        },
        { projection: { status: 1, "brief.city": 1, "brief.shootType": 1, "outcome.lossReason": 1 } }
      )
      .toArray(),
    (await studiosCol())
      .find({ tenantId, stage: { $in: ["verified", "curated"] } }, { projection: { city: 1 } })
      .toArray(),
  ]);

  const rows = new Map<string, MarketDemand & { types: Map<string, number> }>();
  const row = (market: string) => {
    let r = rows.get(market);
    if (!r) {
      r = { market, enquiries: 0, booked: 0, unmet: 0, noStudio: 0, studios: 0, unmetShootTypes: [], types: new Map() };
      rows.set(market, r);
    }
    return r;
  };

  for (const s of studios) {
    const market = marketFor(s.city);
    if (market) row(market).studios++;
  }
  for (const e of enquiries) {
    const market = marketFor(e.brief?.city);
    if (!market) continue;
    const r = row(market);
    r.enquiries++;
    if (e.status === "confirmed" || e.status === "completed") r.booked++;
    if (e.status === "lost" || e.status === "dormant") {
      r.unmet++;
      if (e.outcome?.lossReason === "no_studio_in_city") r.noStudio++;
      const type = e.brief?.shootType ?? "unknown";
      r.types.set(type, (r.types.get(type) ?? 0) + 1);
    }
  }

  return [...rows.values()]
    .filter((r) => r.enquiries > 0)
    .map(({ types, ...r }) => ({
      ...r,
      unmetShootTypes: [...types.entries()]
        .map(([type, count]) => ({ type: type as ShootType | "unknown", count }))
        .sort((a, b) => b.count - a.count),
    }))
    // Biggest gap first: unmet demand per studio we have there.
    .sort((a, b) => b.unmet / (b.studios + 1) - a.unmet / (a.studios + 1) || b.enquiries - a.enquiries);
}
