"use client";

import { useCallback, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { parseAsBoolean, useQueryState } from "nuqs";
import type { LogOutcome } from "@/lib/enums";
import { PIPELINE_COLUMNS, moveInto, type ColumnKey } from "@/lib/pipelineColumns";
import type { PipelineCard as Card, PipelineColumnData } from "@/lib/pipeline";
import type { WorkflowSettings } from "@/lib/validation/settings";
import { PipelineCard } from "@/components/pipeline/PipelineCard";
import { LogUpdateSheet, UndoToast, type Saved } from "@/components/workflow/LogUpdateSheet";

const CLOSED_PREVIEW = 6;

/**
 * The board. A card's stage changes only through what's recorded about it,
 * so dragging a card opens the action that would put it there — the Log
 * update sheet with the matching outcome, or the enquiry's Studios &
 * booking card for options and bookings — and the card moves once that's
 * saved. Cancelling leaves it where it was.
 */
export function PipelineBoard({ columns, settings }: { columns: PipelineColumnData[]; settings: WorkflowSettings }) {
  const router = useRouter();
  const [dueOnly] = useQueryState("due", parseAsBoolean.withDefault(false));
  const [sheet, setSheet] = useState<{ card: Card; outcome: LogOutcome | null } | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ColumnKey | null>(null);
  const [showAllClosed, setShowAllClosed] = useState(false);
  // Parked leads are mostly dead — out of the way unless asked for.
  const [showParked, setShowParked] = useState(false);
  const clearToast = useCallback(() => setSaved(null), []);

  const allCards = columns.flatMap((c) => c.cards);
  const byId = new Map(allCards.map((c) => [c.id, c]));
  const showOwners = new Set(allCards.map((c) => c.ownerName)).size > 1;
  const dragCard = dragId ? byId.get(dragId) ?? null : null;

  function drop(card: Card, column: ColumnKey) {
    const m = moveInto(column, card.status);
    if (!m) return;
    if (m.kind === "studios") router.push(`/enquiries/${card.id}#booking`);
    else setSheet({ card, outcome: m.kind === "log" ? m.outcome : null });
  }

  function onDragStart(card: Card, e: DragEvent) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
    setDragId(card.id);
  }
  function onDragEnd() {
    setDragId(null);
    setOverColumn(null);
  }

  const view = PIPELINE_COLUMNS.map((def) => {
    const server = columns.find((c) => c.key === def.key)!;
    let cards = server.cards;
    if (dueOnly) cards = cards.filter((c) => c.isDue);
    const count = cards.length;
    // Closed is history, not work — keep it short unless asked.
    const hidden = def.key === "closed" && !showAllClosed ? Math.max(0, count - CLOSED_PREVIEW) : 0;
    if (hidden) cards = cards.slice(0, CLOSED_PREVIEW);
    const collapsed = def.key === "parked" && !showParked && !(dragCard && moveInto(def.key, dragCard.status));
    return { def, cards, count, hidden, collapsed, totalLabel: server.totalLabel };
  });

  return (
    <>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:snap-none lg:overflow-visible lg:px-0">
        {view.map(({ def, cards, count, hidden, collapsed, totalLabel }) => {
          const droppable = dragCard ? Boolean(moveInto(def.key, dragCard.status)) : false;
          const isOver = overColumn === def.key && droppable;
          return (
            <section
              key={def.key}
              aria-labelledby={`col-${def.key}`}
              onDragOver={(e) => {
                if (!droppable) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overColumn !== def.key) setOverColumn(def.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverColumn(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const card = dragCard;
                onDragEnd();
                if (card && droppable) drop(card, def.key);
              }}
              className={`flex shrink-0 snap-start flex-col rounded-xl p-2 transition-[background-color,box-shadow,opacity] duration-150 ${
                collapsed ? "w-auto lg:flex-none" : "w-[82vw] max-w-[19rem] lg:w-auto lg:min-w-0 lg:max-w-none lg:flex-1"
              } ${isOver ? "bg-neutral-200/70 ring-2 ring-neutral-900/25" : "bg-neutral-100/80"} ${
                dragCard && !droppable && dragCard.column !== def.key ? "opacity-45" : ""
              }`}
            >
              {collapsed ? (
                <button
                  type="button"
                  id={`col-${def.key}`}
                  onClick={() => setShowParked(true)}
                  aria-expanded={false}
                  title={def.hint}
                  className="flex h-full min-h-24 flex-col items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-semibold text-neutral-700 hover:bg-neutral-200/60 lg:[writing-mode:vertical-rl]"
                >
                  {def.title} <span className="font-normal tabular-nums text-neutral-500">{count}</span>
                </button>
              ) : (
                <>
                  <header className="px-1.5 pb-2 pt-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 id={`col-${def.key}`} className="text-sm font-semibold text-neutral-900">
                        {def.title} <span className="ml-0.5 font-normal tabular-nums text-neutral-500">{count}</span>
                      </h2>
                      {totalLabel && <span className="text-xs font-medium tabular-nums text-neutral-600">{totalLabel}</span>}
                      {def.key === "parked" && (
                        <button type="button" onClick={() => setShowParked(false)} className="link-quiet text-xs" aria-expanded>
                          Hide
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">{def.hint}</p>
                  </header>

                  <ul className="flex flex-1 flex-col gap-2">
                    {cards.length === 0 && (
                      <li className="rounded-lg border border-dashed border-neutral-300 px-3 py-6 text-center text-xs text-neutral-500">
                        {dueOnly ? "Nothing due here." : def.key === "new" ? "No new leads. Press C to add one." : "Nothing here right now."}
                      </li>
                    )}
                    {cards.map((card) => (
                      <PipelineCard
                        key={card.id}
                        card={card}
                        draggable={card.column !== "closed"}
                        dragging={dragId === card.id}
                        onDragStart={(e) => onDragStart(card, e)}
                        onDragEnd={onDragEnd}
                        showOwner={showOwners}
                        onLogUpdate={card.column === "closed" ? null : () => setSheet({ card, outcome: null })}
                      />
                    ))}
                    {def.key === "closed" && (hidden > 0 || (showAllClosed && count > CLOSED_PREVIEW)) && (
                      <li>
                        <button type="button" onClick={() => setShowAllClosed((v) => !v)} className="link-quiet w-full py-1.5 text-xs">
                          {hidden > 0 ? `Show ${hidden} more` : "Show fewer"}
                        </button>
                      </li>
                    )}
                  </ul>
                </>
              )}
            </section>
          );
        })}
      </div>

      {sheet && (
        <LogUpdateSheet
          target={sheet.card.log}
          settings={settings}
          initialOutcome={sheet.outcome}
          onClose={() => setSheet(null)}
          onSaved={(s) => {
            setSheet(null);
            setSaved(s);
            router.refresh();
          }}
        />
      )}
      {saved && <UndoToast saved={saved} onDone={clearToast} />}
    </>
  );
}
