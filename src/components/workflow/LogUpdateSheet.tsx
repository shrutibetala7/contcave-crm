"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { dayKey } from "@/lib/businessDay";
import {
  LOG_OUTCOMES,
  LOG_OUTCOME_LABELS,
  NOT_GOING_AHEAD_REASONS,
  NOT_GOING_AHEAD_LABELS,
  type LogOutcome,
  type NotGoingAheadReason,
} from "@/lib/enums";
import { describeOutcomeResult, planLogUpdate, planRevive, type LogTarget, type Plan, type WorkflowEnquiry } from "@/lib/workflow";
import type { WorkflowSettings } from "@/lib/validation/settings";
import { Icon, type IconName } from "@/components/Icon";

export type { LogTarget } from "@/lib/workflow";

export interface Saved {
  activityId: string;
  message: string;
  undoable: boolean;
}

const OUTCOME_ICON: Record<LogOutcome, IconName> = {
  no_reply: "clock",
  replied: "note",
  postponed: "calendar",
  wants_options: "building",
  chose_studio: "check",
  not_going_ahead: "x",
};

const DATE_CHIPS = [
  { label: "Tomorrow", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
];

const keyIn = (days: number) => dayKey(new Date(Date.now() + days * 86_400_000));
const toIso = (key: string) => `${key}T00:00:00.000Z`;

/**
 * Log update: what happened with this lead, in one tap plus at most one
 * input. The stage and the next follow-up follow from the outcome — the save
 * button says exactly what will happen before you press it. A parked lead
 * gets the Revive form instead.
 *
 * Wants options and Chose a studio hand over to the enquiry's Studios &
 * booking card, where sending options and booking are recorded.
 */
export function LogUpdateSheet({
  target,
  settings,
  initialOutcome,
  onClose,
  onSaved,
}: {
  target: LogTarget;
  settings: WorkflowSettings;
  initialOutcome?: LogOutcome | null;
  onClose: () => void;
  onSaved: (saved: Saved) => void;
}) {
  const router = useRouter();
  const reviving = target.status === "parked";
  const [outcome, setOutcome] = useState<LogOutcome | null>(initialOutcome ?? null);
  const [date, setDate] = useState(() => keyIn(reviving ? 1 : 3));
  const [shootDate, setShootDate] = useState("");
  const [reason, setReason] = useState<NotGoingAheadReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Options and booking are recorded on the enquiry's Studios & booking card.
  function handOver() {
    onClose();
    router.push(`/enquiries/${target.id}#booking`);
  }

  function pick(o: LogOutcome) {
    setError(null);
    if (o === "wants_options" || o === "chose_studio") return handOver();
    setOutcome(o);
  }

  // Esc closes; 1–6 pick an outcome (when not typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return onClose();
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const n = Number(e.key);
      if (!reviving && n >= 1 && n <= LOG_OUTCOMES.length) pick(LOG_OUTCOMES[n - 1]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The same planner the server runs — so the button can promise what happens.
  const preview = useMemo((): { plan: Plan | null; problem: string | null } => {
    const wf: WorkflowEnquiry = {
      status: target.status,
      shortlist: [],
      booking: { offPlatform: false, currency: "INR" },
      brief: { preferredDates: target.preferredDates.map((d) => new Date(d)) },
      noReplyCount: target.noReplyCount,
      noReplyStartedAt: target.noReplyStartedAt,
      firstResponseAt: target.firstResponseAt,
      reachable: target.reachable,
    };
    const ctx = { now: new Date(), userId: "preview" };
    try {
      if (reviving) return { plan: date ? planRevive(wf, new Date(toIso(date)), ctx) : null, problem: null };
      switch (outcome) {
        case "no_reply":
          return { plan: planLogUpdate(wf, { outcome }, settings, ctx), problem: null };
        case "replied":
          return { plan: date ? planLogUpdate(wf, { outcome, followUpOn: new Date(toIso(date)) }, settings, ctx) : null, problem: null };
        case "postponed":
          return { plan: shootDate ? planLogUpdate(wf, { outcome, shootDate: new Date(toIso(shootDate)) }, settings, ctx) : null, problem: null };
        case "not_going_ahead":
          return { plan: reason ? planLogUpdate(wf, { outcome, reason }, settings, ctx) : null, problem: null };
        default:
          return { plan: null, problem: null };
      }
    } catch (e) {
      return { plan: null, problem: e instanceof Error ? e.message : "Can't do that." };
    }
  }, [target, settings, reviving, outcome, date, shootDate, reason]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!preview.plan) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = note.trim() || null;
      const res = reviving
        ? await api.post<{ activityId: string; message: string }>(`/api/enquiries/${target.id}/revive`, { followUpOn: toIso(date), note: trimmed })
        : await api.post<{ activityId: string; message: string }>(`/api/enquiries/${target.id}/log`, {
            outcome,
            note: trimmed,
            ...(outcome === "replied" ? { followUpOn: toIso(date) } : {}),
            ...(outcome === "postponed" ? { shootDate: toIso(shootDate) } : {}),
            ...(outcome === "not_going_ahead" ? { reason } : {}),
          });
      onSaved({ activityId: res.activityId, message: res.message, undoable: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  const dateChips = (
    <div className="flex flex-wrap items-center gap-1.5">
      {DATE_CHIPS.map((c) => {
        const key = keyIn(c.days);
        return (
          <button
            key={c.label}
            type="button"
            aria-pressed={date === key}
            onClick={() => setDate(key)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              date === key ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {c.label}
          </button>
        );
      })}
      <input type="date" aria-label="Follow-up date" value={date} min={keyIn(0)} onChange={(e) => setDate(e.target.value)} className="input w-auto py-1 text-xs" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 sm:items-stretch sm:justify-end" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-update-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full flex-col overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-h-none sm:w-[400px] sm:rounded-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-3">
          <div className="min-w-0">
            <h2 id="log-update-title" className="text-sm font-semibold text-neutral-900">
              {reviving ? "Revive" : "Log update"}
            </h2>
            <p className="truncate text-xs text-neutral-500">{target.title}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-neutral-500 hover:text-neutral-900" aria-label="Close">
            <Icon name="x" className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 px-5 py-4">
          {reviving ? (
            <div className="space-y-2">
              <p className="text-sm text-neutral-700">They&apos;re back in touch. It goes back to Talking — follow up when?</p>
              {dateChips}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="What happened?">
                {LOG_OUTCOMES.map((o, i) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={outcome === o}
                    aria-keyshortcuts={String(i + 1)}
                    onClick={() => pick(o)}
                    className={`flex min-h-14 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                      outcome === o ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-800 hover:border-neutral-400"
                    }`}
                  >
                    <Icon name={OUTCOME_ICON[o]} className="size-4 shrink-0" />
                    <span className="flex-1">{LOG_OUTCOME_LABELS[o]}</span>
                    <span className={`hidden text-[10px] tabular-nums sm:inline ${outcome === o ? "text-neutral-300" : "text-neutral-400"}`}>{i + 1}</span>
                  </button>
                ))}
              </div>

              {outcome === "no_reply" && (
                <p className="text-xs text-neutral-600">
                  No reply {target.noReplyCount + 1} of {settings.parkAfter}
                  {target.noReplyCount + 1 >= settings.parkAfter ? " — this parks the lead as ghosted." : "."}
                </p>
              )}
              {outcome === "replied" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-700">Follow up when?</p>
                  {dateChips}
                </div>
              )}
              {outcome === "postponed" && (
                <label className="block text-xs font-medium text-neutral-700">
                  New shoot date
                  <input type="date" value={shootDate} min={keyIn(0)} onChange={(e) => setShootDate(e.target.value)} autoFocus className="input mt-1" />
                </label>
              )}
              {outcome === "not_going_ahead" && (
                <label className="block text-xs font-medium text-neutral-700">
                  Why not?
                  <select value={reason} onChange={(e) => setReason(e.target.value as NotGoingAheadReason)} autoFocus className="input mt-1">
                    <option value="">Choose a reason…</option>
                    {NOT_GOING_AHEAD_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {NOT_GOING_AHEAD_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          {(reviving || outcome) && (
            <input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="input" />
          )}

          {(preview.problem || error) && (
            <p role="alert" className="text-xs text-red-700">
              {preview.problem ?? error}
            </p>
          )}
        </div>

        <div className="border-t border-neutral-200 px-5 py-3">
          <button type="submit" disabled={busy || !preview.plan} className="btn-primary w-full justify-center">
            {busy ? "Saving…" : preview.plan ? `Save · ${describeOutcomeResult(preview.plan)}` : reviving ? "Pick a date" : "Pick what happened"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** "Saved — Undo" for 5 seconds after a Log update. */
export function UndoToast({ saved, onDone }: { saved: Saved; onDone: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<"shown" | "undoing" | "undone" | "failed">("shown");
  const [message, setMessage] = useState(saved.message);

  useEffect(() => {
    const t = setTimeout(onDone, state === "shown" ? 5000 : 3000);
    return () => clearTimeout(t);
  }, [state, onDone]);

  async function undo() {
    setState("undoing");
    try {
      await api.post(`/api/activities/${saved.activityId}/undo`);
      setState("undone");
      setMessage("Undone.");
      router.refresh();
    } catch (e) {
      setState("failed");
      setMessage(e instanceof ApiError ? e.message : "Couldn't undo it.");
    }
  }

  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg">
      <span className="min-w-0 flex-1 truncate">{message}</span>
      {saved.undoable && state === "shown" && (
        <button type="button" onClick={undo} className="font-semibold underline underline-offset-2">
          Undo
        </button>
      )}
    </div>
  );
}
