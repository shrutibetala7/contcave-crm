import { COMMISSION_RATE_LABEL, formatINR } from "@/lib/money";
import type { RevenueSummary as Summary } from "@/lib/revenue";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Money so far, across the whole team (the owner filter doesn't apply):
 * what the bookings are worth, ContCave's cut of that, and how much of it
 * is from shoots that have actually happened vs. still ahead.
 */
export function RevenueSummary({ summary }: { summary: Summary }) {
  return (
    <section aria-label="Revenue" className="card flex flex-wrap items-stretch divide-neutral-200 sm:divide-x">
      <dl className="w-1/2 px-4 py-3 sm:w-auto sm:pr-6">
        <dt className="text-xs text-neutral-500">Bookings won</dt>
        <dd className="text-lg font-semibold tabular-nums text-neutral-900">{formatINR(summary.bookedValue)}</dd>
      </dl>
      <dl className="w-1/2 px-4 py-3 sm:w-auto sm:px-6">
        <dt className="text-xs text-neutral-500">Our commission ({COMMISSION_RATE_LABEL})</dt>
        <dd className="text-lg font-semibold tabular-nums text-neutral-900">{formatINR(summary.commission)}</dd>
      </dl>
      <dl className="w-full border-t border-neutral-100 px-4 py-3 text-sm sm:w-auto sm:flex-1 sm:border-t-0 sm:px-6">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-neutral-500">Shoots done:</dt>
          <dd className="tabular-nums text-neutral-800">
            {formatINR(summary.completedCommission)} earned · {plural(summary.completedCount, "shoot")}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-neutral-500">Still ahead:</dt>
          <dd className="tabular-nums text-neutral-800">
            {formatINR(summary.upcomingCommission)} to come · {plural(summary.upcomingCount, "booking")}
          </dd>
        </div>
        {summary.missingValueCount > 0 && (
          <p className="mt-1 text-xs text-amber-800">
            {plural(summary.missingValueCount, "won booking")} {summary.missingValueCount === 1 ? "has" : "have"} no value entered, so{" "}
            {summary.missingValueCount === 1 ? "it's" : "they're"} counted as ₹0.
          </p>
        )}
      </dl>
    </section>
  );
}
