"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { FEEDBACK_ISSUES, type EnquiryStatus } from "@/lib/enums";
import type { Feedback } from "@/types/models";

/** Statuses at which feedback is collected; earlier, the card is not shown at all. */
const FEEDBACK_STATUSES = new Set<EnquiryStatus>(["completed", "feedback_pending", "closed_won"]);

/**
 * 1–5 as one-click buttons. Starts unset on purpose: a pre-selected 5 would
 * quietly record a top rating nobody chose.
 */
function RatingInput({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) {
  return (
    <fieldset>
      <legend className="text-xs text-neutral-600">{label}</legend>
      <div className="mt-1 flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={`size-8 rounded-md border text-sm font-medium tabular-nums transition-colors ${
              value === n
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ClientFeedbackForm({ enquiryId, onSaved }: { enquiryId: string; onSaved: () => void }) {
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [studioRating, setStudioRating] = useState<number | null>(null);
  const [platformRating, setPlatformRating] = useState<number | null>(null);
  const [wouldRebook, setWouldRebook] = useState(true);
  const [issues, setIssues] = useState<string[]>([]);
  const [verbatim, setVerbatim] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = overallRating != null && studioRating != null && platformRating != null;

  function toggleIssue(issue: string) {
    setIssues((prev) => (prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]));
  }

  async function submit() {
    if (!complete) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/enquiries/${enquiryId}/feedback`, {
        side: "client",
        overallRating,
        studioRating,
        platformRating,
        wouldRebook,
        issues,
        verbatim: verbatim || null,
        publishedAsReview: false,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <RatingInput label="Overall" value={overallRating} onChange={setOverallRating} />
        <RatingInput label="Studio" value={studioRating} onChange={setStudioRating} />
        <RatingInput label="Platform" value={platformRating} onChange={setPlatformRating} />
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={wouldRebook} onChange={(e) => setWouldRebook(e.target.checked)} />
        Would rebook
      </label>
      <fieldset>
        <legend className="text-xs text-neutral-600">Anything go wrong?</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
          {FEEDBACK_ISSUES.map((issue) => (
            <label key={issue} className="flex items-center gap-1.5 text-sm capitalize text-neutral-700">
              <input type="checkbox" checked={issues.includes(issue)} onChange={() => toggleIssue(issue)} />
              {issue}
            </label>
          ))}
        </div>
      </fieldset>
      <textarea
        aria-label="What the client said"
        value={verbatim}
        onChange={(e) => setVerbatim(e.target.value)}
        placeholder="What did they say?"
        rows={2}
        className="input"
      />
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <button onClick={submit} disabled={busy || !complete} className="btn-secondary">
        {busy ? "Saving…" : "Save client feedback"}
      </button>
      {!complete && <p className="text-xs text-neutral-500">Rate overall, studio and platform to save.</p>}
    </div>
  );
}

function StudioFeedbackForm({ enquiryId, onSaved }: { enquiryId: string; onSaved: () => void }) {
  const [clientRating, setClientRating] = useState<number | null>(null);
  const [paymentOnTime, setPaymentOnTime] = useState(true);
  const [damageReported, setDamageReported] = useState(false);
  const [verbatim, setVerbatim] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (clientRating == null) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/enquiries/${enquiryId}/feedback`, {
        side: "studio",
        clientRating,
        paymentOnTime,
        damageReported,
        verbatim: verbatim || null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <RatingInput label="How was the client?" value={clientRating} onChange={setClientRating} />
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={paymentOnTime} onChange={(e) => setPaymentOnTime(e.target.checked)} />
        Payment on time
      </label>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={damageReported} onChange={(e) => setDamageReported(e.target.checked)} />
        Damage reported
      </label>
      <textarea
        aria-label="What the studio said"
        value={verbatim}
        onChange={(e) => setVerbatim(e.target.value)}
        rows={2}
        className="input"
        placeholder="Studio's comments"
      />
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <button onClick={submit} disabled={busy || clientRating == null} className="btn-secondary">
        {busy ? "Saving…" : "Save studio feedback"}
      </button>
      {clientRating == null && <p className="text-xs text-neutral-500">Rate the client to save.</p>}
    </div>
  );
}

export function FeedbackPanel({
  enquiryId,
  feedback,
  status,
}: {
  enquiryId: string;
  feedback: Feedback;
  status: EnquiryStatus;
}) {
  const router = useRouter();
  const collected = Boolean(feedback.client?.collectedAt || feedback.studio?.collectedAt);

  // Feedback only exists once the shoot has happened (or if some was already logged) —
  // before that the card is just noise.
  if (!collected && !FEEDBACK_STATUSES.has(status)) return null;

  return (
    <div className="card grid grid-cols-1 gap-6 p-4 sm:grid-cols-2">
      <div>
        <h3 className="card-title mb-2">Client feedback</h3>
        {feedback.client?.collectedAt ? (
          <div className="text-sm text-neutral-700">
            <p className="tabular-nums">
              Overall {feedback.client.overallRating}/5 · Studio {feedback.client.studioRating}/5 · Platform{" "}
              {feedback.client.platformRating}/5
            </p>
            <p className="text-xs text-neutral-500">{feedback.client.wouldRebook ? "Would rebook" : "Would not rebook"}</p>
            {feedback.client.verbatim && <p className="mt-1 text-xs italic text-neutral-600">“{feedback.client.verbatim}”</p>}
          </div>
        ) : (
          <ClientFeedbackForm enquiryId={enquiryId} onSaved={() => router.refresh()} />
        )}
      </div>
      <div>
        <h3 className="card-title mb-2">Studio feedback</h3>
        {feedback.studio?.collectedAt ? (
          <div className="text-sm text-neutral-700">
            <p className="tabular-nums">Client {feedback.studio.clientRating}/5</p>
            <p className="text-xs text-neutral-500">
              {feedback.studio.paymentOnTime ? "Paid on time" : "Payment delayed"}
              {feedback.studio.damageReported ? " · damage reported" : ""}
            </p>
            {feedback.studio.verbatim && <p className="mt-1 text-xs italic text-neutral-600">“{feedback.studio.verbatim}”</p>}
          </div>
        ) : (
          <StudioFeedbackForm enquiryId={enquiryId} onSaved={() => router.refresh()} />
        )}
      </div>
    </div>
  );
}
