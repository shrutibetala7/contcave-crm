import { DEMAND_WINDOW_DAYS, type MarketDemand } from "@/lib/studioDemand";

const humanise = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/**
 * Where enquiries come from vs. where we have studios to offer. A city with
 * lost or parked leads and few studios is where to onboard next — and the
 * shoot types say what kind of studio to look for.
 */
export function DemandVsSupply({ rows }: { rows: MarketDemand[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="demand-title" className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="demand-title" className="card-title">
          Demand vs. studios
        </h2>
        <p className="text-xs text-neutral-500">Enquiries in the last {Math.round(DEMAND_WINDOW_DAYS / 30)} months, by city · biggest gap first</p>
      </div>
      <div className="-mx-4 mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th scope="col" className="px-4 py-2 font-medium">City</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Enquiries</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Booked</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Lost / parked</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Studios</th>
              <th scope="col" className="px-4 py-2 font-medium">Unmet shoots</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((r) => {
              const gap = r.unmet > 0 && r.studios === 0;
              return (
                <tr key={r.market} className="border-b border-neutral-100 last:border-b-0">
                  <td className="px-4 py-2 font-medium text-neutral-900">{r.market}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-700">{r.enquiries}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-700">{r.booked}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-700">
                    {r.unmet}
                    {r.noStudio > 0 && (
                      <span className="block text-xs text-neutral-500">{r.noStudio} no studio</span>
                    )}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums ${gap ? "font-semibold text-red-700" : "text-neutral-700"}`}>
                    {r.studios}
                  </td>
                  <td className="px-4 py-2 text-xs text-neutral-600">
                    {r.unmetShootTypes.length
                      ? r.unmetShootTypes
                          .slice(0, 3)
                          .map((t) => `${t.type === "unknown" ? "Not stated" : humanise(t.type)} ${t.count}`)
                          .join(" · ")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
