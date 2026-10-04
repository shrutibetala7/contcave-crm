import Link from "next/link";
import type { PipelineCard } from "@/lib/pipeline";

/**
 * Leads with no phone and no Instagram — nobody can reply to them, so they
 * wait here instead of on the board (and out of its counts) until someone
 * adds who they are, or deletes them.
 */
export function HoldingQueue({ cards }: { cards: PipelineCard[] }) {
  return (
    <details className="card px-4 py-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-neutral-900">
        Needs contact details <span className="font-normal tabular-nums text-neutral-500">{cards.length}</span>
        <span className="ml-2 font-normal text-neutral-500">No phone or Instagram — can&apos;t be worked until someone adds one</span>
      </summary>
      <ul className="mt-2 divide-y divide-neutral-100">
        {cards.map((c) => (
          <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
            <Link href={`/enquiries/${c.id}`} className="font-medium text-neutral-900 hover:underline">
              {c.title}
            </Link>
            <span className="text-xs text-neutral-500">
              {[c.code !== c.title ? c.code : null, c.detail, c.ageLabel].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
