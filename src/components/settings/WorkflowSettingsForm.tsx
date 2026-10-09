"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import type { WorkflowSettings } from "@/lib/validation/settings";

/** The follow-up timings behind Log update. Admins edit; everyone else can see what the rules are. */
export function WorkflowSettingsForm({ settings, canEdit }: { settings: WorkflowSettings; canEdit: boolean }) {
  const router = useRouter();
  const [cadence, setCadence] = useState(settings.cadenceDays.join(", "));
  const [parkAfter, setParkAfter] = useState(String(settings.parkAfter));
  const [optionsHours, setOptionsHours] = useState(String(settings.optionsFollowupHours));
  const [firstReplyHours, setFirstReplyHours] = useState(String(settings.firstReplyHours));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const cadenceDays = cadence.split(/[,\s]+/).filter(Boolean).map(Number);
  const park = Number(parkAfter);
  // With park-after N, only the first N−1 cadence steps are ever used.
  const unused = cadenceDays.length >= park ? cadenceDays.slice(park - 1) : [];

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.put("/api/settings", {
        cadenceDays,
        parkAfter: park,
        optionsFollowupHours: Number(optionsHours),
        firstReplyHours: Number(firstReplyHours),
      });
      setMessage({ kind: "ok", text: "Saved." });
      router.refresh();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Couldn't save." });
    } finally {
      setBusy(false);
    }
  }

  const field = "block text-sm text-neutral-700";
  return (
    <form onSubmit={save} className="card space-y-4 p-4">
      <div>
        <h2 className="card-title">Follow-up timing</h2>
        {!canEdit && <p className="mt-1 text-xs text-neutral-500">Only an admin can change these.</p>}
      </div>
      <fieldset disabled={!canEdit || busy} className="space-y-4">
        <label className={field}>
          No-reply chase days
          <input value={cadence} onChange={(e) => setCadence(e.target.value)} className="input mt-1" inputMode="numeric" />
          <span className="mt-1 block text-xs text-neutral-500">
            Days after the first no-reply in a row that each chase is due, e.g. 1, 3, 7.
          </span>
        </label>
        <label className={field}>
          Park after this many no-replies in a row
          <input value={parkAfter} onChange={(e) => setParkAfter(e.target.value)} type="number" min={1} max={10} className="input mt-1 w-24" />
          {unused.length > 0 && (
            <span className="mt-1 block text-xs text-amber-800">
              The lead is parked on no-reply {park}, so the {unused.join(", ")}-day step{unused.length === 1 ? " is" : "s are"} never used.
            </span>
          )}
        </label>
        <label className={field}>
          Check back after sending options (hours)
          <input value={optionsHours} onChange={(e) => setOptionsHours(e.target.value)} type="number" min={1} max={168} className="input mt-1 w-24" />
        </label>
        <label className={field}>
          First reply target for new leads (hours)
          <input value={firstReplyHours} onChange={(e) => setFirstReplyHours(e.target.value)} type="number" min={1} max={72} className="input mt-1 w-24" />
        </label>
      </fieldset>
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`text-xs ${message.kind === "error" ? "text-red-700" : "text-green-800"}`}>
          {message.text}
        </p>
      )}
      {canEdit && (
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save"}
        </button>
      )}
    </form>
  );
}
