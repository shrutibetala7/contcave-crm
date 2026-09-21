"use client";

import { useState, type KeyboardEvent } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import { FilterChips } from "@/components/FilterChips";
import { CopyViewButton } from "@/components/CopyViewButton";
import { STUDIO_STAGES, STUDIO_STAGE_LABELS } from "@/lib/enums";

export function StudiosFilters() {
  const [params, setParams] = useQueryStates(
    { q: parseAsString, city: parseAsString, stage: parseAsString, page: parseAsString },
    { history: "push", shallow: false }
  );
  const [q, setQ] = useState(params.q ?? "");
  const [city, setCity] = useState(params.city ?? "");
  const anyFilter = Boolean(params.q || params.city || params.stage);

  function setParam(key: "q" | "city", value: string) {
    setParams({ [key]: value || null, page: null });
  }

  function clearAll() {
    setQ("");
    setCity("");
    setParams({ q: null, city: null, stage: null, page: null });
  }

  return (
    <div className="space-y-3">
      <FilterChips label="Filter by status" param="stage" options={STUDIO_STAGES.map((s) => ({ value: s, label: STUDIO_STAGE_LABELS[s] }))} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          type="search"
          aria-label="Search studios by name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && setParam("q", q)}
          onBlur={() => q !== (params.q ?? "") && setParam("q", q)}
          placeholder="Search by name…"
          className="input w-full sm:max-w-xs"
        />
        <input
          aria-label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && setParam("city", city)}
          onBlur={() => city !== (params.city ?? "") && setParam("city", city)}
          placeholder="City"
          className="input w-32"
        />
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
