"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { dayKey } from "@/lib/businessDay";
import { describeDay } from "@/lib/workflow";
import type { EnquiryStatus, FollowUpKind } from "@/lib/enums";

/** Follow-ups that are a task to tick off, not a conversation to log. */
const TASK_KINDS: FollowUpKind[] = ["confirm_timings", "send_feedback", "collect_commission"];

/**
 * The one next follow-up on this enquiry: what, when, and whose. Chasing a
 * lead is finished by logging what happened (the Log update button); task
 * follow-ups — confirm timings, send feedback, collect commission — get a
 * Done here, which hands on to the next task in the chain.
 */
export function FollowUpCard({
  enquiryId,
  status,
  followUp,
  tone,
  ownerName,
}: {
  enquiryId: string;
  status: EnquiryStatus;
  followUp: { kind: FollowUpKind; label: string; dueAt: string; allDay: boolean } | null;
  tone: { label: string; tone: "overdue" | "today" | "soon" | "later" } | null;
  ownerName: string | null;
}) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(followUp ? dayKey(followUp.dueAt) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMoving(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  function reschedule(e: FormEvent) {
    e.preventDefault();
    if (!date) return setError("Pick a date.");
    void run(() => api.post(`/api/enquiries/${enquiryId}/followup`, { dueOn: `${date}T00:00:00.000Z` }));
  }

  const toneClass =
    tone?.tone === "overdue" ? "text-red-700" : tone?.tone === "today" ? "text-amber-800" : "text-neutral-500";

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="card-title">Next follow-up</h3>
        {followUp && !moving && (
          <button type="button" onClick={() => setMoving(true)} className="link-quiet py-1 text-xs">
            Reschedule
          </button>
        )}
      </div>
      {followUp ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-neutral-900">{followUp.label}</p>
          <p className="tabular-nums text-neutral-700">
            {describeDay(followUp.dueAt)}
            {!followUp.allDay &&
              `, ${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(new Date(followUp.dueAt))}`}
            {tone && (tone.tone === "overdue" || tone.tone === "today") && <span className={`ml-2 text-xs font-medium ${toneClass}`}>{tone.label}</span>}
          </p>
          <p className="text-xs text-neutral-500">Owner: {ownerName ?? "Unassigned"}</p>
          {moving && (
            <form onSubmit={reschedule} className="flex flex-wrap items-center gap-2 pt-2">
              <input type="date" aria-label="New follow-up date" value={date} min={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} className="input w-auto" />
              <button type="submit" disabled={busy} className="btn-secondary btn-sm">
                Move it
              </button>
              <button type="button" onClick={() => setMoving(false)} className="link-quiet text-xs">
                Cancel
              </button>
            </form>
          )}
          {TASK_KINDS.includes(followUp.kind) && !moving && (
            <button type="button" disabled={busy} onClick={() => run(() => api.post(`/api/enquiries/${enquiryId}/followup/done`))} className="btn-secondary btn-sm mt-2">
              {followUp.kind === "collect_commission" ? "Commission received" : "Done"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          {status === "parked"
            ? "Parked — nothing scheduled. Revive it if they get back in touch."
            : status === "new" || status === "talking" || status === "options_sent" || status === "confirmed"
              ? "No follow-up set — log an update to set one."
              : "Closed — nothing left to do."}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
