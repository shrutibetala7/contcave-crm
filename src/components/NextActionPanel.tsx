"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { api, ApiError } from "@/lib/apiClient";
import type { UserOption } from "@/lib/users";

const MIN_REASON_LENGTH = 8;

/**
 * "Every open record must carry a next action with a date and an owner"
 * (spec §2, the core principle) — shown on both enquiry and studio detail.
 * Change Brief v1.1 §B: a date with no reason is a date with no context —
 * the API rejects any write setting nextActionDate without a
 * nextActionReason of at least MIN_REASON_LENGTH characters.
 */
export function NextActionPanel({
  entityUrl,
  ownerId,
  nextActionDate,
  nextActionReason,
  users,
}: {
  entityUrl: string;
  ownerId: string | null;
  nextActionDate: string | null;
  nextActionReason: string | null;
  users: UserOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [owner, setOwner] = useState(ownerId ?? "");
  const [date, setDate] = useState(nextActionDate ? nextActionDate.slice(0, 10) : "");
  const [reason, setReason] = useState(nextActionReason ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonTooShort = Boolean(date) && reason.trim().length < MIN_REASON_LENGTH;

  async function save() {
    if (reasonTooShort) {
      setError(`Reason must be at least ${MIN_REASON_LENGTH} characters when a date is set`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patch(entityUrl, {
        ownerId: owner || null,
        nextActionDate: date ? new Date(date).toISOString() : null,
        nextActionReason: date ? reason : null,
      });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="card-title">Next action</h3>
        <button onClick={() => setEditing((v) => !v)} className="link-quiet py-1 text-xs">
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {!editing ? (
        <div className="text-sm">
          <p className="font-medium text-neutral-800">
            {nextActionDate ? format(new Date(nextActionDate), "d MMM yyyy") : "No date set"}
          </p>
          {nextActionDate &&
            (nextActionReason ? (
              <p className="text-neutral-600">{nextActionReason}</p>
            ) : (
              <p className="flag-amber mt-1 inline-block">No reason recorded</p>
            ))}
          <p className="mt-1 text-xs text-neutral-500">
            Owner: {users.find((u) => u.id === ownerId)?.name ?? "Unassigned"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? (required when a date is set, min 8 characters)"
            rows={2}
            className="input"
          />
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="input">
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <button onClick={save} disabled={busy || reasonTooShort} className="btn-primary">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
