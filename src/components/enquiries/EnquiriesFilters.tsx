"use client";

import { useState, type KeyboardEvent } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import { FilterChips } from "@/components/FilterChips";
import { CopyViewButton } from "@/components/CopyViewButton";
import { ENQUIRY_STATUSES } from "@/lib/enums";
import type { UserOption } from "@/lib/users";

export function EnquiriesFilters({ users }: { users: UserOption[] }) {
  const [params, setParams] = useQueryStates(
    { q: parseAsString, owner: parseAsString, status: parseAsString, page: parseAsString },
    { history: "push", shallow: false }
  );
  const [q, setQ] = useState(params.q ?? "");
  const anyFilter = Boolean(params.q || params.owner || params.status);

  function setParam(key: "q" | "owner", value: string) {
    setParams({ [key]: value || null, page: null });
  }

  function clearAll() {
    setQ("");
    setParams({ q: null, owner: null, status: null, page: null });
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") setParam("q", q);
  }

  return (
    <div className="space-y-3">
      <FilterChips
        label="Filter by status"
        param="status"
        options={ENQUIRY_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") }))}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          type="search"
          aria-label="Search enquiries"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onSearchKeyDown}
          onBlur={() => q !== (params.q ?? "") && setParam("q", q)}
          placeholder="Search code or brief…"
          className="input w-full sm:max-w-xs"
        />
        <select aria-label="Owner" value={params.owner ?? ""} onChange={(e) => setParam("owner", e.target.value)} className="input w-auto">
          <option value="">All owners</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {anyFilter && (
          <button onClick={clearAll} className="link-quiet py-1 text-xs">
            Clear filters
          </button>
        )}
        <span className="ml-auto">
          <CopyViewButton />
        </span>
      </div>
    </div>
  );
}
