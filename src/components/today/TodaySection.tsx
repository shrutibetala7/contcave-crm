import { DueRow } from "@/components/today/DueRow";
import type { DueItem } from "@/lib/dashboardToday";

export function TodaySection({
  title,
  emphasis,
  items,
  emptyText = "Nothing here.",
}: {
  title: string;
  emphasis?: "danger" | "default";
  items: DueItem[];
  emptyText?: string;
}) {
  const id = `sec-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className={`mb-2 flex items-baseline gap-2 text-sm font-semibold ${
          emphasis === "danger" && items.length > 0 ? "text-red-700" : "text-neutral-900"
        }`}
      >
        {title}
        <span className="text-xs font-normal tabular-nums text-neutral-500">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        // An empty bucket is one quiet line, not a full-height card competing with real work.
        <p className="text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <div className="card overflow-hidden">
          {items.map((item, i) => (
            <DueRow key={`${item.kind}-${item.entityId}-${i}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
