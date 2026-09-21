"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import type { StudioStage } from "@/lib/enums";
import { allowedNextStages, forwardStage } from "@/lib/stateMachine/studioStage";

const label = (s: string) => s.replace(/_/g, " ");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function StageControl({ studioId, currentStage }: { studioId: string; currentStage: StudioStage }) {
  const router = useRouter();
  const [to, setTo] = useState<StudioStage | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forward = forwardStage(currentStage);
  const others = allowedNextStages(currentStage).filter((s) => s !== forward);

  async function apply(target: StudioStage | "" = to) {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/studios/${studioId}/stage`, { to: target, note: note || null });
      setTo("");
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not change stage");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="card-title">Stage</h3>
        <StatusBadge status={currentStage} />
      </div>

      {forward && (
        // "active" is guarded (tier + checklist), so it opens the form with its hint; the rest go straight through.
        <button onClick={() => (forward === "active" ? setTo(forward) : void apply(forward))} disabled={busy} className="btn-primary w-full justify-between">
          <span>{currentStage === "paused" || currentStage === "churned" || currentStage === "not_interested" ? "Reopen as lead" : `Move to ${label(forward)}`}</span>
          <Icon name="arrow" className="size-4" />
        </button>
      )}
      {others.length > 0 && (
        <select
          aria-label="Other stage moves"
          value={to && to !== forward ? to : ""}
          onChange={(e) => setTo(e.target.value as StudioStage)}
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

      {to && (
        <div className="space-y-2 border-t border-neutral-100 pt-3">
          <p className="text-sm font-medium text-neutral-900">Move to {label(to)}</p>
          <input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="input" />
          {to === "active" && (
            <p className="text-xs text-neutral-600">Needs a tier and every required onboarding checklist item complete.</p>
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
