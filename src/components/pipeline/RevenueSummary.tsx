import { COMMISSION_RATE_LABEL, formatINR, withGst } from "@/lib/money";
import type { RevenueSummary as Summary } from "@/lib/revenue";

function Figure({ label, amount, note }: { label: string; amount: number; note?: string }) {
  return (
    <dl className="px-4 py-3 sm:pr-8">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-neutral-900">{formatINR(amount)}</dd>
      <dd className="text-xs tabular-nums text-neutral-500">({formatINR(withGst(amount))} with GST)</dd>
      {note && <dd className="mt-0.5 text-xs text-neutral-500">{note}</dd>}
    </dl>
  );
}

/**
 * Money so far, across the whole team (the owner filter doesn't apply): what
 * the bookings are worth and our cut — before GST, with the GST-inclusive
 * figure beneath. "To collect" only appears while some commission is unpaid.
 */
export function RevenueSummary({ summary }: { summary: Summary }) {
  return (
    <section aria-label="Revenue" className="card flex flex-wrap items-start divide-neutral-200 sm:divide-x">
      <Figure label="Bookings won" amount={summary.bookedValue} />
      <Figure label={`Our commission (${COMMISSION_RATE_LABEL})`} amount={summary.commission} />
      {summary.owedCommission + summary.upcomingCommission > 0 && (
        <Figure
          label="Commission to collect"
          amount={summary.owedCommission + summary.upcomingCommission}
          note="Mark it received on the enquiry once the studio pays."
        />
      )}
    </section>
  );
}
