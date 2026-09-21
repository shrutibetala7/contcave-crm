"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { api, ApiError } from "@/lib/apiClient";
import { SHORTLIST_OUTCOMES } from "@/lib/enums";
import type { ShortlistEntryDoc } from "@/types/models";

export function ShortlistTable({
  enquiryId,
  shortlist,
  studioOptions,
}: {
  enquiryId: string;
  shortlist: ShortlistEntryDoc[];
  studioOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newStudioId, setNewStudioId] = useState("");
  const [newQuote, setNewQuote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function updateEntry(entryId: string, patch: Record<string, unknown>) {
    setError(null);
    try {
      await api.patch(`/api/enquiries/${enquiryId}/shortlist/${entryId}`, patch);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update");
    }
  }

  async function removeEntry(entryId: string) {
    setError(null);
    setConfirmingId(null);
    try {
      await api.delete(`/api/enquiries/${enquiryId}/shortlist/${entryId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove");
    }
  }

  async function addEntry() {
    if (!newStudioId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/enquiries/${enquiryId}/shortlist`, {
        studioId: newStudioId,
        quotedAmount: newQuote ? Number(newQuote) : null,
      });
      setNewStudioId("");
      setNewQuote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add studio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <h3 className="mb-3 card-title">Shortlist</h3>
      {shortlist.length === 0 ? (
        <p className="text-sm text-neutral-500">No studios shortlisted yet.</p>
      ) : (
        <div className="mb-3 space-y-2">
          {shortlist.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-100 p-2">
              <Link href={`/studios/${entry.studioId}`} className="min-w-[8rem] flex-1 text-sm font-medium text-neutral-900 hover:underline">
                {entry.studioName}
              </Link>
              <span className="w-24 text-xs tabular-nums text-neutral-600">
                {entry.quotedAmount != null ? `₹${entry.quotedAmount.toLocaleString("en-IN")}` : "No quote"}
              </span>
              <select
                aria-label={`Outcome for ${entry.studioName}`}
                key={`${entry.id}-${entry.outcome}`}
                defaultValue={entry.outcome}
                onChange={(e) => updateEntry(entry.id, { outcome: e.target.value })}
                className="input w-auto text-xs capitalize"
              >
                {SHORTLIST_OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {o.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <span className="text-xs text-neutral-500">sent {format(new Date(entry.sentAt), "d MMM")}</span>
              {confirmingId === entry.id ? (
                <span className="flex items-center gap-2 text-xs">
                  <button onClick={() => removeEntry(entry.id)} className="font-medium text-red-700 hover:underline">
                    Remove
                  </button>
                  <button onClick={() => setConfirmingId(null)} className="link-quiet">
                    Keep
                  </button>
                </span>
              ) : (
                <button onClick={() => setConfirmingId(entry.id)} className="link-quiet text-xs" aria-label={`Remove ${entry.studioName} from shortlist`}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-neutral-100 pt-3">
        <select aria-label="Studio to add" value={newStudioId} onChange={(e) => setNewStudioId(e.target.value)} className="input flex-1">
          <option value="">Add studio…</option>
          {studioOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Quoted amount in rupees"
          value={newQuote}
          onChange={(e) => setNewQuote(e.target.value)}
          placeholder="Quote ₹"
          type="number"
          className="input w-28"
        />
        <button onClick={addEntry} disabled={busy || !newStudioId} className="btn-secondary">
          Add
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
