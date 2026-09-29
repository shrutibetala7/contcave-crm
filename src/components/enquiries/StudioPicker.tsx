"use client";

import { useId, useState, type KeyboardEvent } from "react";

export interface StudioOption {
  id: string;
  name: string;
  /** "Gurugram", "East of Kailash, South Delhi" — tells two similar names apart. */
  area: string | null;
}

/**
 * Type to find a studio by name or area. A combobox rather than a <select>,
 * so a long studio list stays usable: arrows move, Enter picks, Esc closes.
 */
export function StudioPicker({
  options,
  selected,
  onSelect,
}: {
  options: StudioOption[];
  selected: StudioOption | null;
  onSelect: (studio: StudioOption | null) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = query.trim().toLowerCase();
  const matches = (q ? options.filter((s) => `${s.name} ${s.area ?? ""}`.toLowerCase().includes(q)) : options).slice(0, 8);

  function pick(studio: StudioOption) {
    onSelect(studio);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        role="combobox"
        aria-label="Studio to add"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        value={selected && !open ? selected.name : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          if (selected) onSelect(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={options.length ? "Search studios by name or area…" : "Every studio is already on the shortlist"}
        disabled={!options.length}
        className="input"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-neutral-500">No studio matches “{query.trim()}”.</li>
          ) : (
            matches.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-${s.id}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: fires before the input's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 text-sm ${
                  i === active ? "bg-neutral-100" : ""
                }`}
              >
                <span className="truncate text-neutral-900">{s.name}</span>
                {s.area && <span className="shrink-0 truncate text-xs text-neutral-500">{s.area}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
