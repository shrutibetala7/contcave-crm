"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { STUDIO_STAGES, STUDIO_STAGE_LABELS, type StudioStage } from "@/lib/enums";

/**
 * A studio is in one of four states; click the one that's true. There are no
 * transition rules — it applies straight away (and is logged on the timeline).
 */
export function StageControl({ studioId, currentStage }: { studioId: string; currentStage: StudioStage }) {
  const router = useRouter();
  const [stage, setStage] = useState(currentStage);
  const [error, setError] = useState<string | null>(null);
  // Follow the server whenever a refresh brings a different value (render-time sync, no Effect).
  const [seen, setSeen] = useState(currentStage);
  if (currentStage !== seen) {
    setSeen(currentStage);
    setStage(currentStage);
  }

  async function choose(next: StudioStage) {
    if (next === stage) return;
    const previous = stage;
    setStage(next);
    setError(null);
    try {
      await api.post(`/api/studios/${studioId}/stage`, { to: next });
      router.refresh();
    } catch (e) {
      setStage(previous);
      setError(e instanceof ApiError ? e.message : "Could not update status");
    }
  }

  return (
    <div className="card p-4">
      <h3 className="card-title mb-3">Status</h3>
      <div role="radiogroup" aria-label="Studio status" className="grid grid-cols-2 gap-2">
        {STUDIO_STAGES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={stage === s}
            onClick={() => choose(s)}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              stage === s
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {STUDIO_STAGE_LABELS[s]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
