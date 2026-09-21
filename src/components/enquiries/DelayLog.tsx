"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { api, ApiError } from "@/lib/apiClient";
import { DELAY_CAUSED_BY } from "@/lib/enums";
import type { DelayEventDoc } from "@/types/models";

/** Picking a date must not save by itself: typing a year fires change on 0002, 0020, 0202… */
function RescheduleField({ onSave }: { onSave: (date: string) => void }) {
  const [date, setDate] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
      <label className="flex items-center gap-2">
        Reschedule to
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-auto py-1 text-xs" />
      </label>
      <button onClick={() => onSave(date)} disabled={!date} className="btn-secondary btn-sm">
        Save new date
      </button>
    </div>
  );
}

export function DelayLog({ enquiryId, delayEvents }: { enquiryId: string; delayEvents: DelayEventDoc[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [previousDate, setPreviousDate] = useState("");
  const [newDate, setNewDate] = useState("");
  const [estimatedWindow, setEstimatedWindow] = useState("");
  const [reason, setReason] = useState("");
  const [causedBy, setCausedBy] = useState<(typeof DELAY_CAUSED_BY)[number]>("client");
  const [followUpOn, setFollowUpOn] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/enquiries/${enquiryId}/delays`, {
        previousDate: previousDate ? new Date(previousDate).toISOString() : new Date().toISOString(),
        newDate: newDate ? new Date(newDate).toISOString() : null,
        estimatedWindow: estimatedWindow || null,
        reason,
        causedBy,
        followUpOn: followUpOn ? new Date(followUpOn).toISOString() : null,
        followUpReason: followUpReason || null,
      });
      setShowForm(false);
      setPreviousDate("");
      setNewDate("");
      setEstimatedWindow("");
      setReason("");
      setFollowUpOn("");
      setFollowUpReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not log delay");
    } finally {
      setBusy(false);
    }
  }

  async function resolveWithDate(delayId: string, dateValue: string) {
    if (!dateValue) return;
    setError(null);
    try {
      await api.patch(`/api/enquiries/${enquiryId}/delays/${delayId}`, {
        newDate: new Date(dateValue).toISOString(),
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not resolve delay");
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="card-title">Delay log</h3>
        <button onClick={() => setShowForm((v) => !v)} className="link-quiet py-1 text-xs">
          {showForm ? "Cancel" : "+ Log a delay"}
        </button>
      </div>

      {delayEvents.length === 0 && !showForm && <p className="text-sm text-neutral-500">No delays logged.</p>}

      <div className="space-y-2">
        {delayEvents.map((d) => (
          <div key={d.id} className="rounded-md border border-neutral-100 p-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${d.resolved ? "bg-neutral-100 text-neutral-500" : "bg-orange-100 text-orange-800"}`}>
                {d.resolved ? "resolved" : "unresolved"}
              </span>
              <span className="text-xs text-neutral-500">caused by {d.causedBy}</span>
              <span className="text-neutral-800">{d.reason}</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              was {format(new Date(d.previousDate), "d MMM")} →{" "}
              {d.newDate ? format(new Date(d.newDate), "d MMM") : d.estimatedWindow || "TBD"}
              {d.followUpOn && !d.resolved ? ` · follow up ${format(new Date(d.followUpOn), "d MMM")}` : ""}
            </p>
            {!d.resolved &&
              (d.followUpReason ? (
                <p className="mt-1 text-xs text-neutral-700">{d.followUpReason}</p>
              ) : (
                <p className="flag-amber mt-1 inline-block text-xs">No reason recorded</p>
              ))}
            {!d.resolved && <RescheduleField onSave={(value) => resolveWithDate(d.id, value)} />}
          </div>
        ))}
      </div>

      {showForm && (
        <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-neutral-500">
              Previous shoot date
              <input type="date" value={previousDate} onChange={(e) => setPreviousDate(e.target.value)} className="input mt-1" />
            </label>
            <label className="text-xs text-neutral-500">
              New date (if known)
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input mt-1" />
            </label>
          </div>
          {!newDate && (
            <>
              <label className="block text-xs text-neutral-500">
                Estimated window
                <input
                  value={estimatedWindow}
                  onChange={(e) => setEstimatedWindow(e.target.value)}
                  placeholder="mid-October, after Diwali…"
                  className="input mt-1"
                />
              </label>
              <label className="block text-xs text-neutral-500">
                Follow up on (required while date is unknown)
                <input type="date" value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} className="input mt-1" />
              </label>
              <label className="block text-xs text-neutral-500">
                Why check back then? (required, min 8 characters)
                <input
                  value={followUpReason}
                  onChange={(e) => setFollowUpReason(e.target.value)}
                  className="input mt-1"
                />
              </label>
            </>
          )}
          <label className="block text-xs text-neutral-500">
            Caused by
            <select value={causedBy} onChange={(e) => setCausedBy(e.target.value as typeof causedBy)} className="input mt-1">
              {DELAY_CAUSED_BY.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-neutral-500">
            Reason
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="input mt-1" />
          </label>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <button
            onClick={submit}
            disabled={busy || !reason || (!newDate && (!followUpOn || followUpReason.trim().length < 8))}
            className="btn-primary"
          >
            {busy ? "Saving…" : "Log delay"}
          </button>
        </div>
      )}
      {!showForm && error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
