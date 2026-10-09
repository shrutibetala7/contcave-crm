"use client";

import Link from "next/link";
import type { DragEvent } from "react";
import { Icon } from "@/components/Icon";
import { instagramProfileUrl } from "@/lib/instagram";
import { whatsappLink } from "@/lib/whatsapp";
import type { DueTone, PipelineCard as Card } from "@/lib/pipeline";

const CHIP = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset";
const TONE: Record<DueTone, string> = {
  overdue: `${CHIP} bg-red-50 text-red-700 ring-red-200`,
  today: `${CHIP} bg-amber-50 text-amber-800 ring-amber-200`,
  soon: `${CHIP} bg-neutral-100 text-neutral-700 ring-neutral-200`,
  later: `${CHIP} bg-white text-neutral-600 ring-neutral-200`,
};
const OUTCOME_TONE: Record<string, string> = {
  done: `${CHIP} bg-green-50 text-green-800 ring-green-200`,
  lost: `${CHIP} bg-white text-red-700 ring-red-200`,
  cancelled: `${CHIP} bg-white text-orange-800 ring-orange-200`,
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function PipelineCard({
  card,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onLogUpdate,
  showOwner,
}: {
  card: Card;
  /** Off when one person owns everything on the board — the badge would say nothing. */
  showOwner: boolean;
  draggable: boolean;
  dragging: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  /** Opens the Log update sheet (Revive, on a parked card). Null on closed cards. */
  onLogUpdate: (() => void) | null;
}) {
  const closed = card.column === "closed";
  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative rounded-lg border bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,opacity,box-shadow] duration-150 ${
        closed ? "border-neutral-200 bg-neutral-50/60" : "border-neutral-200 hover:border-neutral-300 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {/* The whole card opens the enquiry; the buttons below sit above this link. */}
          <Link
            href={`/enquiries/${card.id}`}
            draggable={false}
            className={`block truncate text-sm font-medium after:absolute after:inset-0 after:rounded-lg ${
              closed ? "text-neutral-700" : "text-neutral-900"
            }`}
          >
            {card.title}
          </Link>
          {card.subtitle && <p className="truncate text-xs text-neutral-500">{card.subtitle}</p>}
        </div>
        {onLogUpdate && (
          <button
            type="button"
            onClick={onLogUpdate}
            aria-label={`${card.status === "parked" ? "Revive" : "Log update for"} ${card.title}`}
            title={card.status === "parked" ? "Revive" : "Log update"}
            className="relative z-10 -mr-1 -mt-1 rounded px-1.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            {card.status === "parked" ? "Revive" : "Log"}
          </button>
        )}
      </div>

      {(card.detail || card.shootLabel || card.valueLabel || card.estimateLabel) && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-600">
          {card.detail && <span className="truncate">{card.detail}</span>}
          {card.shootLabel && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Icon name="calendar" className="size-3" />
              {card.shootLabel.replace(/^Shoot /, "")}
            </span>
          )}
          {card.valueLabel && <span className="font-medium tabular-nums text-neutral-800">{card.valueLabel}</span>}
          {card.estimateLabel && (
            <span className="tabular-nums text-neutral-500" title="Estimated from the studio quote or their budget">
              {card.estimateLabel}
            </span>
          )}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {card.follow && (
            <span className={`${TONE[card.follow.tone]} whitespace-nowrap`} title="Next follow-up">
              <Icon name="clock" className="size-3" />
              {card.follow.label}
            </span>
          )}
          {card.needsFollowUpDate && onLogUpdate && (
            <button
              type="button"
              onClick={onLogUpdate}
              className={`${CHIP} relative z-10 whitespace-nowrap bg-amber-50 text-amber-800 ring-amber-200 transition-colors hover:bg-amber-100`}
            >
              <Icon name="plus" className="size-3" />
              No follow-up
            </button>
          )}
          {card.noReplyCount > 0 && (
            <span className="text-xs text-neutral-500" title="No-replies logged in a row">
              {card.noReplyCount} no-repl{card.noReplyCount === 1 ? "y" : "ies"}
            </span>
          )}
          {card.ageLabel &&
            (card.replyOverdue ? (
              <span className={`${TONE.overdue} whitespace-nowrap`} title="No first reply yet — the target is 2 hours">
                {card.ageLabel} · no reply
              </span>
            ) : (
              <span className="text-xs text-neutral-500">{card.ageLabel}</span>
            ))}
          {card.outcomeLabel && (
            <span className={`${OUTCOME_TONE[card.status] ?? CHIP} max-w-full truncate`}>{card.outcomeLabel}</span>
          )}
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1.5">
          {card.phone ? (
            <a
              href={whatsappLink(card.phone)}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              aria-label={`WhatsApp ${card.title}`}
              title="WhatsApp"
              className="rounded p-1 text-green-700 transition-colors hover:bg-green-50"
            >
              <Icon name="whatsapp" className="size-3.5" />
            </a>
          ) : card.instagramHandle ? (
            <a
              href={instagramProfileUrl(card.instagramHandle)}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              aria-label={`Instagram @${card.instagramHandle}`}
              title={`@${card.instagramHandle}`}
              className="rounded p-1 text-pink-700 transition-colors hover:bg-pink-50"
            >
              <Icon name="instagram" className="size-3.5" />
            </a>
          ) : null}
          {showOwner && card.ownerName && (
            <span
              title={`Owner: ${card.ownerName}`}
              className="inline-flex size-5 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600"
            >
              {initials(card.ownerName)}
            </span>
          )}
        </div>
      </div>

      {card.follow?.reason && (
        <p className="mt-1.5 line-clamp-2 text-xs text-neutral-600" title={card.follow.reason}>
          {card.follow.reason}
        </p>
      )}

    </li>
  );
}
