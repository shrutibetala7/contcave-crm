"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { dayKey } from "@/lib/businessDay";
import {
  CANCEL_REASONS,
  CANCEL_REASON_LABELS,
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_LABELS,
  LOSS_REASONS,
  LOSS_REASON_LABELS,
  isOpenStatus,
  type EnquiryStatus,
} from "@/lib/enums";
import { Icon } from "@/components/Icon";

/**
 * Admin only, tucked behind ⋯: put the enquiry in a stage directly — for a
 * mistake that's past Undo. Always asks why, and the reason goes on the
 * timeline.
 */
export function OverrideStage({ enquiryId, currentStatus }: { enquiryId: string; currentStatus: EnquiryStatus }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<EnquiryStatus | "">("");
  const [reason, setReason] = useState("");
  const [followUpOn, setFollowUpOn] = useState(() => dayKey(new Date(Date.now() + 86_400_000)));
  const [lossReason, setLossReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!to) return setError("Choose a stage.");
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/enquiries/${enquiryId}/override`, {
        to,
        reason,
        followUpOn: isOpenStatus(to) ? `${followUpOn}T00:00:00.000Z` : null,
        lossReason: to === "lost" || to === "parked" ? lossReason || null : null,
        cancelReason: to === "cancelled" ? cancelReason || null : null,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change the stage.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="More actions" title="Override stage (admin)" className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
        <Icon name="more" className="size-4" />
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card w-full space-y-2 p-4 text-sm sm:w-80">
      <p className="font-medium text-neutral-900">Override stage</p>
      <p className="text-xs text-neutral-500">For fixing mistakes. It skips the normal steps, and the reason goes on the timeline.</p>
      <select aria-label="Stage" value={to} onChange={(e) => setTo(e.target.value as EnquiryStatus)} className="input">
        <option value="">Choose a stage…</option>
        {ENQUIRY_STATUSES.filter((s) => s !== currentStatus).map((s) => (
          <option key={s} value={s}>
            {ENQUIRY_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {to && isOpenStatus(to) && (
        <label className="block text-xs text-neutral-600">
          Follow up on
          <input type="date" value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} className="input mt-1" />
        </label>
      )}
      {(to === "lost" || to === "parked") && (
        <select aria-label="Reason" value={lossReason} onChange={(e) => setLossReason(e.target.value)} className="input">
          <option value="">Why?</option>
          {LOSS_REASONS.map((r) => (
            <option key={r} value={r}>
              {LOSS_REASON_LABELS[r]}
            </option>
          ))}
        </select>
      )}
      {to === "cancelled" && (
        <select aria-label="Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="input">
          <option value="">Why?</option>
          {CANCEL_REASONS.map((r) => (
            <option key={r} value={r}>
              {CANCEL_REASON_LABELS[r]}
            </option>
          ))}
        </select>
      )}
      <input aria-label="Reason for the override" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the override? (required)" className="input" />
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-secondary btn-sm">
          {busy ? "Saving…" : "Override"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="link-quiet text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}
