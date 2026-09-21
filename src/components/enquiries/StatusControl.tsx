"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import { LOSS_REASONS, type EnquiryStatus } from "@/lib/enums";
import { allowedNextStatuses, forwardStatus } from "@/lib/stateMachine/enquiryStatus";

const label = (s: string) => s.replace(/_/g, " ");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// What each guarded move needs, said before the user hits the wall rather than after.
const HINTS: Partial<Record<EnquiryStatus, string>> = {
  confirmed: "Needs one studio marked “picked” in the shortlist, and a booking (or off-platform) set.",
  scheduled: "Needs a shoot date.",
  completed: "The shoot date must already be in the past.",
  closed_won: "Needs client feedback saved, or feedback waived with a reason.",
};

// Forward steps with no guard: one click, no form.
const DIRECT = new Set<EnquiryStatus>(["contacted", "qualified", "shortlist_sent", "negotiating", "feedback_pending"]);

export function StatusControl({ enquiryId, currentStatus }: { enquiryId: string; currentStatus: EnquiryStatus }) {
  const router = useRouter();
  const [to, setTo] = useState<EnquiryStatus | "">("");
  const [note, setNote] = useState("");
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

  const forward = forwardStatus(currentStatus);
  const allowed = allowedNextStatuses(currentStatus);
  // "delayed" is entered by logging a delay (which needs a reason and follow-up), never from this menu.
  const others = allowed.filter((s) => s !== "delayed" && s !== forward);
  const isBackward = to !== "" && to !== forward && !["lost", "dormant"].includes(to) && allowed.includes(to);

  async function apply(target: EnquiryStatus | "" = to) {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/enquiries/${enquiryId}/status`, {
        to: target,
        note: note || null,
        lossReason: lossReason || null,
        lossNote: lossNote || null,
        competitorName: competitorName || null,
        nextActionDate: nextActionDate ? new Date(nextActionDate).toISOString() : null,
        nextActionReason: nextActionReason || null,
        currentShootDate: currentShootDate ? new Date(currentShootDate).toISOString() : null,
        feedbackWaived,
        feedbackWaivedNote: feedbackWaivedNote || null,
      });
      setTo("");
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not change status");
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    if (!forward) return;
    if (DIRECT.has(forward)) void apply(forward);
    else setTo(forward);
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="card-title">Status</h3>
        <StatusBadge status={currentStatus} />
      </div>

      {allowed.length === 0 ? (
        <p className="text-sm text-neutral-500">This enquiry is closed — no further moves.</p>
      ) : (
        <>
          {forward && (
            <button onClick={advance} disabled={busy} className="btn-primary w-full justify-between">
              <span>Move to {label(forward)}</span>
              <Icon name="arrow" className="size-4" />
            </button>
          )}
          {others.length > 0 && (
            <select
              aria-label="Other status moves"
              value={to && to !== forward ? to : ""}
              onChange={(e) => setTo(e.target.value as EnquiryStatus)}
              className="input"
            >
              <option value="">Other move…</option>
              {others.map((s) => (
                <option key={s} value={s}>
                  {cap(label(s))}
                </option>
              ))}
            </select>
          )}
          {currentStatus === "scheduled" && (
            <p className="text-xs text-neutral-500">To mark a shoot delayed, log it in the Delay log.</p>
          )}
        </>
      )}

      {to && (
        <div className="space-y-2 border-t border-neutral-100 pt-3">
          <p className="text-sm font-medium text-neutral-900">Move to {label(to)}</p>
          {HINTS[to] && <p className="text-xs text-neutral-600">{HINTS[to]}</p>}

          <label className="block text-xs text-neutral-600">
            Note {isBackward && <span className="text-amber-800">(required for a backward move)</span>}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input mt-1" />
          </label>

          {to === "lost" && (
            <>
              <label className="block text-xs text-neutral-600">
                Loss reason (required)
                <select value={lossReason} onChange={(e) => setLossReason(e.target.value)} className="input mt-1">
                  <option value="">Choose a reason…</option>
                  {LOSS_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {cap(label(r))}
                    </option>
                  ))}
                </select>
              </label>
              {lossReason === "chose_competitor" && (
                <label className="block text-xs text-neutral-600">
                  Competitor
                  <input value={competitorName} onChange={(e) => setCompetitorName(e.target.value)} className="input mt-1" />
                </label>
              )}
              <label className="block text-xs text-neutral-600">
                Loss note
                <input value={lossNote} onChange={(e) => setLossNote(e.target.value)} className="input mt-1" />
              </label>
            </>
          )}

          {to === "dormant" && (
            <>
              <label className="block text-xs text-neutral-600">
                Revival date (required)
                <input type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} className="input mt-1" />
              </label>
              <label className="block text-xs text-neutral-600">
                Why parked? (required, min 8 characters)
                <input value={nextActionReason} onChange={(e) => setNextActionReason(e.target.value)} className="input mt-1" />
              </label>
            </>
          )}

          {to === "scheduled" && (
            <label className="block text-xs text-neutral-600">
              Shoot date (required if not already set)
              <input type="date" value={currentShootDate} onChange={(e) => setCurrentShootDate(e.target.value)} className="input mt-1" />
            </label>
          )}

          {to === "closed_won" && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-neutral-700">
                <input type="checkbox" checked={feedbackWaived} onChange={(e) => setFeedbackWaived(e.target.checked)} />
                Waive the feedback requirement
              </label>
              {feedbackWaived && (
                <input
                  aria-label="Why feedback is being waived"
                  value={feedbackWaivedNote}
                  onChange={(e) => setFeedbackWaivedNote(e.target.value)}
                  placeholder="Why is feedback being waived?"
                  className="input"
                />
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => apply()} disabled={busy} className="btn-primary">
              {busy ? "Applying…" : `Move to ${label(to)}`}
            </button>
            <button onClick={() => setTo("")} className="link-quiet text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}
      {!to && error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
