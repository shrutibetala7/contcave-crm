"use client";

import { useQueryStates, parseAsString } from "nuqs";
import { CopyViewButton } from "@/components/CopyViewButton";
import { TODAY_RANGES, type TodayRange } from "@/lib/todayRanges";
import type { UserOption } from "@/lib/users";

const RANGE_LABELS: Record<TodayRange, string> = {
  week: "7 days",
  "14d": "14 days",
  "30d": "30 days",
};

/** Change Brief v1.1 §C: Today screen's owner + range toggles, in the URL. */
export function TodayFilters({ users }: { users: UserOption[] }) {
  const [params, setParams] = useQueryStates(
    { owner: parseAsString, range: parseAsString },
    { history: "push", shallow: false }
  );
  const activeRange = params.range ?? "week";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <select
        aria-label="Owner"
        value={params.owner ?? ""}
        onChange={(e) => setParams({ owner: e.target.value || null })}
        className="input w-auto"
      >
        <option value="">Everyone</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      <div role="group" aria-label="Look-ahead window" className="flex gap-1">
        {(Object.keys(TODAY_RANGES) as TodayRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setParams({ range: range === "week" ? null : range })}
            aria-pressed={activeRange === range}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeRange === range
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {RANGE_LABELS[range]}
          </button>
        ))}
      </div>
      <CopyViewButton />
    </div>
  );
}
