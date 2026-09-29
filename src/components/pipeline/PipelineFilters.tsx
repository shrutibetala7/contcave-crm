"use client";

import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { Icon } from "@/components/Icon";
import type { UserOption } from "@/lib/users";

/** Owner (a server filter) and "Due now" (a client-side narrowing of the board), both kept in the URL. */
export function PipelineFilters({ users, dueCount }: { users: UserOption[]; dueCount: number }) {
  const [owner, setOwner] = useQueryState("owner", parseAsString.withOptions({ history: "push", shallow: false }));
  const [dueOnly, setDueOnly] = useQueryState("due", parseAsBoolean.withDefault(false).withOptions({ history: "push" }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setDueOnly(dueOnly ? null : true)}
        aria-pressed={dueOnly}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
          dueOnly ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
        }`}
      >
        <Icon name="clock" className="size-3.5" />
        Due now
        <span className={`tabular-nums ${dueOnly ? "text-neutral-300" : "text-neutral-500"}`}>{dueCount}</span>
      </button>
      <select aria-label="Owner" value={owner ?? ""} onChange={(e) => setOwner(e.target.value || null)} className="input w-auto">
        <option value="">Everyone</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  );
}
