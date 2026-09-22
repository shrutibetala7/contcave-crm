"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { ENQUIRY_STATUSES, LOSS_REASONS, type EnquiryStatus } from "@/lib/enums";
import { allowedNextStatuses } from "@/lib/stateMachine/enquiryStatus";

const label = (s: string) => s.replace(/_/g, " ");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const statusLabel = (s: string) => cap(label(s));

/**
 * The status is one dropdown. Picking a status applies it straight away —
 * unless that move needs a piece of information (why it was lost, when to
 * revisit a parked enquiry, the shoot date, why feedback is skipped), in
 * which case a small form opens first. Only statuses the enquiry can actually
 * move to are listed; the rest is enforced on the server with plain-language errors.
 */
export function StatusControl({
  enquiryId,
  currentStatus,
  shootDate,
}: {
  enquiryId: string;
  currentStatus: EnquiryStatus;
  /** ISO date of the current shoot date, if one is already set. */
  shootDate: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<EnquiryStatus | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [lossNote, setLossNote] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [nextActionReason, setNextActionReason] = useState("");
  const [currentShootDate, setCurrentShootDate] = useState("");
  const [feedbackWaived, setFeedbackWaived] = useState(false);
  const [feedbackWaivedNote, setFeedbackWaivedNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "delayed" is set by logging a delay (which needs a reason and a follow-up), never from here.
  const options: EnquiryStatus[] = allowedNextStatuses(currentStatus).filter((s) => s !== "delayed");
  const list = ENQUIRY_STATUSES.filter((s) => s === currentStatus || options.includes(s));

  const needsDetails = (to: EnquiryStatus) =>
    to === "lost" || to === "dormant" || to === "closed_won" || (to === "scheduled" && !shootDate);

  async function apply(to: EnquiryStatus) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/enquiries/${enquiryId}/status`, {
        to,
        lossReason: lossReason || null,
        lossNote: lossNote || null,
        competitorName: competitorName || null,
        nextActionDate: nextActionDate ? new Date(nextActionDate).toISOString() : null,
        nextActionReason: nextActionReason || null,
        currentShootDate: currentShootDate ? new Date(currentShootDate).toISOString() : null,
        feedbackWaived,
        feedbackWaivedNote: feedbackWaivedNote || null,
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
            {statusLabel(s)}
          </option>
        ))}
      </select>

      {closed && <p className="text-xs text-neutral-500">This enquiry is closed, so its status can no longer change.</p>}
      {currentStatus === "scheduled" && (
        <p className="text-xs text-neutral-500">If the shoot slips, log it in the Delay log.</p>
      )}

      {pending && (
        <div className="space-y-2 border-t border-neutral-100 pt-3">
          <p className="text-sm font-medium text-neutral-900">Change to {label(pending)}</p>

          {pending === "lost" && (
            <>
              <label className="block text-xs text-neutral-600">
                Why was it lost?
                <select value={lossReason} onChange={(e) => setLossReason(e.target.value)} className="input mt-1">
                  <option value="">Choose a reason…</option>
                  {LOSS_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {statusLabel(r)}
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

          {pending === "scheduled" && (
            <label className="block text-xs text-neutral-600">
              Shoot date
              <input type="date" value={currentShootDate} onChange={(e) => setCurrentShootDate(e.target.value)} className="input mt-1" />
            </label>
          )}

          {pending === "closed_won" && (
            <div className="space-y-1.5">
              <p className="text-xs text-neutral-600">Closing as won needs the client&apos;s feedback saved first.</p>
              <label className="flex items-center gap-2 text-xs text-neutral-700">
                <input type="checkbox" checked={feedbackWaived} onChange={(e) => setFeedbackWaived(e.target.checked)} />
                Skip feedback for this one
              </label>
              {feedbackWaived && (
                <input
                  aria-label="Why feedback is being skipped"
                  value={feedbackWaivedNote}
                  onChange={(e) => setFeedbackWaivedNote(e.target.value)}
                  placeholder="Why is feedback being skipped?"
                  className="input"
                />
              )}
            </div>
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
