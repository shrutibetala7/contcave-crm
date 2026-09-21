"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { api, ApiError } from "@/lib/apiClient";
import { Icon, type IconName } from "@/components/Icon";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import type { DueItem } from "@/lib/dashboardToday";

const MIN_REASON_LENGTH = 8;

const KIND: Record<DueItem["kind"], { label: string; icon: IconName; tone: string }> = {
  enquiry_next_action: { label: "Enquiry", icon: "inbox", tone: "text-neutral-500" },
  delay_follow_up: { label: "Delay follow-up", icon: "clock", tone: "text-orange-700" },
  new_unactioned: { label: "New enquiry", icon: "plus", tone: "text-blue-700" },
};

/** Change Brief v1.1 §B: the reason leads, everything else is context. */
export function DueRow({ item }: { item: DueItem }) {
  const router = useRouter();
  const [snoozing, setSnoozing] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState(item.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every kind here sets a date via this form, so a reason is always required.
  const reasonTooShort = reason.trim().length < MIN_REASON_LENGTH;
  const kind = KIND[item.kind];

  async function submitSnooze() {
    if (!date) return;
    if (reasonTooShort) {
      setError(`Reason must be at least ${MIN_REASON_LENGTH} characters`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const iso = new Date(date).toISOString();
      if (item.kind === "enquiry_next_action" || item.kind === "new_unactioned") {
        await api.patch(`/api/enquiries/${item.entityId}`, { nextActionDate: iso, nextActionReason: reason });
      } else if (item.kind === "delay_follow_up" && item.delayId) {
        await api.patch(`/api/enquiries/${item.entityId}/delays/${item.delayId}`, {
          followUpOn: iso,
          followUpReason: reason,
        });
      }
      setSnoozing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not snooze");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={`mt-0.5 ${kind.tone}`} title={kind.label}>
            <Icon name={kind.icon} className="size-4" />
            <span className="sr-only">{kind.label}: </span>
          </span>
          <div className="min-w-0 flex-1">
            <Link href={item.href} className="line-clamp-2 text-sm font-medium text-neutral-900 hover:underline">
              {item.reason ? (
                item.reason
              ) : item.kind === "new_unactioned" ? (
                <span className="text-neutral-600">New — not yet triaged</span>
              ) : (
                <span className="flag-amber">No reason recorded</span>
              )}
            </Link>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {item.title}
              {item.code && <span> · {item.code}</span>}
              {item.overdueDays ? <span className="font-medium text-red-700"> · overdue {item.overdueDays}d</span> : null}
              {item.ownerName && <span> · {item.ownerName}</span>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 pl-7 sm:pl-0">
          <time dateTime={item.dueDate} className="w-12 text-xs tabular-nums text-neutral-500">
            {format(new Date(item.dueDate), "d MMM")}
          </time>
          <WhatsAppLink phone={item.contactPhone} className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline" />
          {!snoozing && (
            <button onClick={() => setSnoozing(true)} className="btn-secondary btn-sm">
              Snooze
            </button>
          )}
          <Link href={item.href} className="btn-primary btn-sm">
            Open
          </Link>
        </div>
      </div>

      {snoozing && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
          <input
            type="date"
            autoFocus
            aria-label="Snooze until"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input w-auto py-1 text-xs"
          />
          <input
            aria-label="Reason for the follow-up"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? (required, min 8 characters)"
            className="input min-w-[14rem] flex-1 py-1 text-xs"
          />
          <button onClick={submitSnooze} disabled={busy || !date || reasonTooShort} className="btn-primary btn-sm">
            {busy ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setSnoozing(false)} className="link-quiet text-xs">
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 pl-7 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
