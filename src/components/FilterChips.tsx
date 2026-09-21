"use client";

import { useQueryStates, parseAsString } from "nuqs";

export interface ChipOption {
  value: string;
  label: string;
}

/**
 * Sets/clears a single query param (Change Brief v1.1 §C: filter state
 * lives in the URL). `shallow: false` is required because the list itself
 * is fetched server-side from `searchParams` — a shallow (client-only) URL
 * update wouldn't re-run the Server Component. `history: "push"` so the
 * browser back button steps through filter changes.
 */
export function FilterChips({
  param,
  options,
  allLabel = "All",
  label,
}: {
  param: string;
  options: ChipOption[];
  allLabel?: string;
  label: string;
}) {
  const [state, setState] = useQueryStates(
    { [param]: parseAsString, page: parseAsString },
    { history: "push", shallow: false }
  );
  const active = state[param];

  function setValue(value: string | null) {
    setState({ [param]: value, page: null });
  }

  const chip = (isActive: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
      isActive
        ? "border-neutral-900 bg-neutral-900 text-white"
        : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100"
    }`;

  return (
    // One scrolling row on phones (a 13-chip wall pushes the list off-screen), wrapping from sm up.
    <div role="group" aria-label={label} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
      <button onClick={() => setValue(null)} aria-pressed={!active} className={chip(!active)}>
        {allLabel}
      </button>
      {options.map((opt) => (
        <button key={opt.value} onClick={() => setValue(opt.value)} aria-pressed={active === opt.value} className={chip(active === opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
