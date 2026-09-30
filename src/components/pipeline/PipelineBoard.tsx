"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsBoolean, useQueryState } from "nuqs";
import { api, ApiError } from "@/lib/apiClient";
import {
  CANCEL_REASONS,
  CANCEL_REASON_LABELS,
  ENQUIRY_STATUS_LABELS,
  LOSS_REASONS,
  type EnquiryStatus,
} from "@/lib/enums";
import { PIPELINE_COLUMNS, moveInto, type ColumnKey, type ColumnMove } from "@/lib/pipelineColumns";
import { dayKey } from "@/lib/businessDay";
import type { PipelineCard as Card, PipelineColumnData } from "@/lib/pipeline";
import { celebrate } from "@/lib/celebrate";
import { PipelineCard } from "@/components/pipeline/PipelineCard";

const MIN_REASON = 8;
const CLOSED_PREVIEW = 6;
const humanise = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const COLUMN_TITLE = Object.fromEntries(PIPELINE_COLUMNS.map((c) => [c.key, c.title])) as Record<ColumnKey, string>;

/** A move that needs an answer first (when to chase / how it ended), shown inside the card. */
interface Pending {
  id: string;
  move: Extract<ColumnMove, { kind: "follow_up" | "close" }>;
  /** Just changing the follow-up date — the card stays where it is. */
  rescheduleOnly: boolean;
}

export function PipelineBoard({ columns }: { columns: PipelineColumnData[] }) {
  const router = useRouter();
  const [dueOnly] = useQueryState("due", parseAsBoolean.withDefault(false));
  // Where a card has been moved to, ahead of the server confirming it.
  const [overrides, setOverrides] = useState<Record<string, ColumnKey>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ColumnKey | null>(null);

  const [showAllClosed, setShowAllClosed] = useState(false);

  const allCards = columns.flatMap((c) => c.cards);
  const byId = new Map(allCards.map((c) => [c.id, c]));
  const showOwners = new Set(allCards.map((c) => c.ownerName)).size > 1;
  const dragCard = dragId ? byId.get(dragId) ?? null : null;

  function place(id: string, column: ColumnKey | null) {
    setOverrides((prev) => {
      const next = { ...prev };
      if (column) next[id] = column;
      else delete next[id];
      return next;
    });
  }
  function setError(id: string, message: string | null) {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }

  async function move(card: Card, column: ColumnKey) {
    setMenuFor(null);
    const m = moveInto(column, card.status);
    if (!m) return;
    setError(card.id, null);
    if (m.kind === "book") {
      router.push(`/enquiries/${card.id}#booking`);
      return;
    }
    if (m.kind !== "direct") {
      place(card.id, column);
      setPending({ id: card.id, move: m, rescheduleOnly: false });
      return;
    }
    place(card.id, column);
    setBusyId(card.id);
    try {
      await api.post(`/api/enquiries/${card.id}/status`, { to: m.to });
      router.refresh();
    } catch (e) {
      place(card.id, null);
      setError(card.id, e instanceof ApiError ? e.message : "Couldn't move it.");
    } finally {
      setBusyId(null);
    }
  }

  function cancelPending() {
    if (pending && !pending.rescheduleOnly) place(pending.id, null);
    setPending(null);
  }

  // ---- drag and drop (desktop); the ⋯ menu does the same for touch and keyboard ----
  function onDragStart(card: Card, e: DragEvent) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
    setDragId(card.id);
    setMenuFor(null);
  }
  function onDragEnd() {
    setDragId(null);
    setOverColumn(null);
  }
  function canDrop(column: ColumnKey) {
    return Boolean(dragCard && moveInto(column, dragCard.status));
  }

  const view = PIPELINE_COLUMNS.map((def) => {
    const server = columns.find((c) => c.key === def.key)!;
    const movedIn = allCards.filter((c) => overrides[c.id] === def.key && c.column !== def.key);
    const staying = server.cards.filter((c) => !overrides[c.id] || overrides[c.id] === def.key);
    let cards = [...movedIn, ...staying];
    if (dueOnly) cards = cards.filter((c) => c.isDue || c.id === pending?.id);
    const count = cards.length;
    // Closed is history, not work — keep it short unless asked.
    const hidden = def.key === "closed" && !showAllClosed ? Math.max(0, count - CLOSED_PREVIEW) : 0;
    if (hidden) cards = cards.slice(0, CLOSED_PREVIEW);
    return { def, cards, count, hidden, totalLabel: server.totalLabel };
  });

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:snap-none lg:overflow-visible lg:px-0">
      {view.map(({ def, cards, count, hidden, totalLabel }) => {
        const droppable = dragCard ? canDrop(def.key) : false;
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
              if (card && droppable) void move(card, def.key);
            }}
            className={`flex w-[82vw] max-w-[19rem] shrink-0 snap-start flex-col rounded-xl p-2 transition-[background-color,box-shadow,opacity] duration-150 lg:w-auto lg:min-w-0 lg:max-w-none lg:flex-1 ${
              isOver ? "bg-neutral-200/70 ring-2 ring-neutral-900/25" : "bg-neutral-100/80"
            } ${dragCard && !droppable && dragCard.column !== def.key ? "opacity-45" : ""}`}
          >
            <header className="px-1.5 pb-2 pt-1">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id={`col-${def.key}`} className="text-sm font-semibold text-neutral-900">
                  {def.title} <span className="ml-0.5 font-normal tabular-nums text-neutral-500">{count}</span>
                </h2>
                {totalLabel && <span className="text-xs font-medium tabular-nums text-neutral-600">{totalLabel}</span>}
              </div>
              <p className="text-xs text-neutral-500">{def.hint}</p>
            </header>

            <ul className="flex flex-1 flex-col gap-2">
              {cards.length === 0 && (
                <li className="rounded-lg border border-dashed border-neutral-300 px-3 py-6 text-center text-xs text-neutral-500">
                  {dueOnly ? "Nothing due here." : def.key === "new" ? "No new leads. Press C to add one." : "Nothing here right now."}
                </li>
              )}
              {cards.map((card) => {
                const isPending = pending?.id === card.id;
                const showMenu = menuFor === card.id && !isPending;
                const error = errors[card.id];
                return (
                  <PipelineCard
                    key={card.id}
                    card={card}
                    draggable={card.column !== "closed" && !isPending && busyId !== card.id}
                    dragging={dragId === card.id}
                    busy={busyId === card.id}
                    onDragStart={(e) => onDragStart(card, e)}
                    onDragEnd={onDragEnd}
                    menuOpen={showMenu}
                    showOwner={showOwners}
                    onSetFollowUp={() => {
                      setMenuFor(null);
                      setError(card.id, null);
                      setPending({ id: card.id, move: { kind: "follow_up" }, rescheduleOnly: true });
                    }}
                    onToggleMenu={() => {
                      setMenuFor((v) => (v === card.id ? null : card.id));
                      setError(card.id, null);
                    }}
                  >
                    {isPending ? (
                      <PendingForm
                        card={card}
                        pending={pending}
                        busy={busyId === card.id}
                        onCancel={cancelPending}
                        onBusy={(b) => setBusyId(b ? card.id : null)}
                        onDone={() => {
                          setPending(null);
                          router.refresh();
                        }}
                      />
                    ) : showMenu ? (
                      <CardMenu
                        card={card}
                        onMove={(col) => void move(card, col)}
                        onReschedule={() => {
                          setMenuFor(null);
                          setPending({ id: card.id, move: { kind: "follow_up" }, rescheduleOnly: true });
                        }}
                      />
                    ) : error ? (
                      <p role="alert" className="text-xs text-red-700">
                        {error}{" "}
                        <Link href={`/enquiries/${card.id}`} className="font-medium underline underline-offset-2">
                          Open enquiry
                        </Link>
                      </p>
                    ) : null}
                  </PipelineCard>
                );
              })}
              {def.key === "closed" && (hidden > 0 || (showAllClosed && count > CLOSED_PREVIEW)) && (
                <li>
                  <button type="button" onClick={() => setShowAllClosed((v) => !v)} className="link-quiet w-full py-1.5 text-xs">
                    {hidden > 0 ? `Show ${hidden} more` : "Show fewer"}
                  </button>
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CardMenu({
  card,
  onMove,
  onReschedule,
}: {
  card: Card;
  onMove: (column: ColumnKey) => void;
  onReschedule: () => void;
}) {
  const targets = PIPELINE_COLUMNS.map((c) => c.key).filter((k) => moveInto(k, card.status));
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-neutral-500">Move to</p>
      <div className="flex flex-wrap gap-1.5">
        {targets.map((k) => (
          <button key={k} type="button" onClick={() => onMove(k)} className="btn-secondary btn-sm">
            {k === "confirmed" ? "Book a studio" : COLUMN_TITLE[k]}
          </button>
        ))}
      </div>
      <button type="button" onClick={onReschedule} className="link-quiet text-xs">
        {card.follow ? "Change follow-up date" : "Set a follow-up date"}
      </button>
    </div>
  );
}

function tomorrowKey(): string {
  return dayKey(new Date(Date.now() + 86_400_000));
}

function PendingForm({
  card,
  pending,
  busy,
  onCancel,
  onBusy,
  onDone,
}: {
  card: Card;
  pending: Pending;
  busy: boolean;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
  onDone: () => void;
}) {
  const closeOptions = pending.move.kind === "close" ? pending.move.options : [];
  // Keep an existing follow-up date unless it has already passed; otherwise suggest tomorrow.
  const [date, setDate] = useState(card.follow && card.follow.tone !== "overdue" ? card.follow.date : tomorrowKey());
  const [reason, setReason] = useState(card.follow?.reason ?? "");
  const [outcome, setOutcome] = useState<EnquiryStatus | "">(closeOptions.length === 1 ? closeOptions[0] : "");
  const [why, setWhy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pending.move.kind === "follow_up") {
      if (!date) return setError("Pick a date.");
      if (reason.trim().length < MIN_REASON) return setError(`Say why in a few words (at least ${MIN_REASON} characters).`);
    } else {
      if (!outcome) return setError("Choose how it ended.");
      if (outcome !== "completed" && !why) return setError("Choose a reason.");
      if (outcome === "cancelled" && why === "other" && !note.trim()) return setError("Say what the reason was.");
    }

    onBusy(true);
    try {
      if (pending.move.kind === "follow_up") {
        if (!pending.rescheduleOnly && card.status !== "on_hold" && card.status !== "dormant") {
          await api.post(`/api/enquiries/${card.id}/status`, { to: "on_hold" });
        }
        await api.patch(`/api/enquiries/${card.id}`, {
          nextActionDate: new Date(`${date}T00:00:00.000Z`).toISOString(),
          nextActionReason: reason.trim(),
        });
      } else {
        await api.post(`/api/enquiries/${card.id}/status`, {
          to: outcome,
          lossReason: outcome === "lost" ? why : null,
          lossNote: outcome === "lost" ? note || null : null,
          cancelReason: outcome === "cancelled" ? why : null,
          cancelNote: outcome === "cancelled" ? note || null : null,
        });
      }
      onDone();
      if (pending.move.kind === "close" && outcome === "completed") celebrate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that.");
    } finally {
      onBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {pending.move.kind === "follow_up" ? (
        <>
          <p className="text-xs font-medium text-neutral-700">{pending.rescheduleOnly ? "Follow up on" : "Move to Follow up — chase on"}</p>
          <input
            type="date"
            aria-label="Follow-up date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input py-1 text-xs"
          />
          <input
            aria-label="Why follow up"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? e.g. Waiting on their shoot date"
            autoFocus
            className="input py-1 text-xs"
          />
        </>
      ) : (
        <>
          <p className="text-xs font-medium text-neutral-700">How did it end?</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Outcome">
            {closeOptions.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={outcome === s}
                onClick={() => {
                  setOutcome(s);
                  setWhy("");
                }}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  outcome === s ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {ENQUIRY_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {outcome === "lost" && (
            <select aria-label="Why was it lost" value={why} onChange={(e) => setWhy(e.target.value)} className="input py-1 text-xs">
              <option value="">Why was it lost?</option>
              {LOSS_REASONS.map((r) => (
                <option key={r} value={r}>
                  {humanise(r)}
                </option>
              ))}
            </select>
          )}
          {outcome === "cancelled" && (
            <select aria-label="Why was it cancelled" value={why} onChange={(e) => setWhy(e.target.value)} className="input py-1 text-xs">
              <option value="">Why was it cancelled?</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {CANCEL_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          )}
          {(outcome === "lost" || outcome === "cancelled") && (
            <input
              aria-label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={outcome === "cancelled" && why === "other" ? "What was the reason?" : "Note (optional)"}
              className="input py-1 text-xs"
            />
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="link-quiet text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}
