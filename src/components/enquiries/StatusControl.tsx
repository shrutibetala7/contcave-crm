"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { CANCEL_REASONS, CANCEL_REASON_LABELS, ENQUIRY_STATUSES, ENQUIRY_STATUS_LABELS, LOSS_REASONS, type EnquiryStatus } from "@/lib/enums";
import { allowedNextStatuses } from "@/lib/stateMachine/enquiryStatus";

const label = (s: string) => s.replace(/_/g, " ");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lossLabel = (s: string) => cap(label(s));

/**
 * The status is one dropdown, listing only the statuses this enquiry can
 * actually reach. Picking one applies it straight away — unless it needs a
 * reason (Cancelled, Lost, Dormant), in which case a small form opens first.
 */
export function StatusControl({ enquiryId, currentStatus }: { enquiryId: string; currentStatus: EnquiryStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState<EnquiryStatus | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [lossNote, setLossNote] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [nextActionReason, setNextActionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: EnquiryStatus[] = allowedNextStatuses(currentStatus);
  const list = ENQUIRY_STATUSES.filter((s) => s === currentStatus || options.includes(s));

  const needsDetails = (to: EnquiryStatus) => to === "lost" || to === "cancelled" || to === "dormant";

  async function apply(to: EnquiryStatus) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/enquiries/${enquiryId}/status`, {
        to,
        lossReason: lossReason || null,
        lossNote: lossNote || null,
        competitorName: competitorName || null,
        cancelReason: cancelReason || null,
        cancelNote: cancelNote || null,
        nextActionDate: nextActionDate ? new Date(nextActionDate).toISOString() : null,
        nextActionReason: nextActionReason || null,
      });
      setPending(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not change the status.");
    } finally {
      setBusy(false);
    }
  }

  function choose(to: EnquiryStatus) {
    setError(null);
    if (to === currentStatus) {
      setPending(null);
    } else if (needsDetails(to)) {
      setPending(to);
    } else {
      setPending(null);
      void apply(to);
    }
  }

  const closed = options.length === 0;

  return (
    <div className="card space-y-3 p-4">
      <h3 className="card-title">Status</h3>

      <select
        aria-label="Status"
        value={pending ?? currentStatus}
        onChange={(e) => choose(e.target.value as EnquiryStatus)}
        disabled={busy || closed}
        className="input"
      >
        {list.map((s) => (
          <option key={s} value={s}>
            {ENQUIRY_STATUS_LABELS[s]}
          </option>
        ))}
      </select>

      {closed && <p className="text-xs text-neutral-500">This enquiry is closed, so its status can no longer change.</p>}
      {currentStatus === "confirmed" && (
        <p className="text-xs text-neutral-500">Confirmed can still move to On Hold or Cancelled if the booking falls through.</p>
      )}

      {pending && (
        <div className="space-y-2 border-t border-neutral-100 pt-3">
          <p className="text-sm font-medium text-neutral-900">Change to {ENQUIRY_STATUS_LABELS[pending]}</p>

          {pending === "cancelled" && (
            <>
              <label className="block text-xs text-neutral-600">
                Why was it cancelled?
                <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="input mt-1">
                  <option value="">Choose a reason…</option>
                  {CANCEL_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {CANCEL_REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              {cancelReason === "other" && (
                <label className="block text-xs text-neutral-600">
                  What was the reason?
                  <input value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} className="input mt-1" autoFocus />
                </label>
              )}
              {cancelReason && cancelReason !== "other" && (
                <label className="block text-xs text-neutral-600">
                  Note (optional)
                  <input value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} className="input mt-1" />
                </label>
              )}
            </>
          )}

          {pending === "lost" && (
            <>
              <label className="block text-xs text-neutral-600">
                Why was it lost?
                <select value={lossReason} onChange={(e) => setLossReason(e.target.value)} className="input mt-1">
                  <option value="">Choose a reason…</option>
                  {LOSS_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {lossLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              {lossReason === "chose_competitor" && (
                <label className="block text-xs text-neutral-600">
                  Which competitor?
                  <input value={competitorName} onChange={(e) => setCompetitorName(e.target.value)} className="input mt-1" />
                </label>
              )}
              <label className="block text-xs text-neutral-600">
                Note (optional)
                <input value={lossNote} onChange={(e) => setLossNote(e.target.value)} className="input mt-1" />
              </label>
            </>
          )}

          {pending === "dormant" && (
            <>
              <label className="block text-xs text-neutral-600">
                Revisit on
                <input type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} className="input mt-1" />
              </label>
              <label className="block text-xs text-neutral-600">
                Why is it parked? (at least 8 characters)
                <input value={nextActionReason} onChange={(e) => setNextActionReason(e.target.value)} className="input mt-1" />
              </label>
            </>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => apply(pending)} disabled={busy} className="btn-primary">
              {busy ? "Saving…" : "Change status"}
            </button>
            <button onClick={() => setPending(null)} disabled={busy} className="link-quiet text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
