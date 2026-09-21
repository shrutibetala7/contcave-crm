"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import type { Onboarding } from "@/types/models";

const LABELS: Record<keyof Onboarding, string> = {
  legalDocument: "Legal document",
  picturesVideos: "Pictures / videos",
  pricing: "Pricing",
  packagesAmenities: "Packages / amenities",
  aadhar: "Aadhar",
  bankAccountDetails: "Bank account details",
  gst: "GST (optional)",
};

const KEYS = Object.keys(LABELS) as (keyof Onboarding)[];

export function OnboardingChecklist({ studioId, onboarding }: { studioId: string; onboarding: Onboarding }) {
  const router = useRouter();
  // Optimistic local copy: the checkbox reflects the click immediately
  // rather than waiting on a PATCH + router.refresh() round trip, which
  // otherwise lets a second quick click land while the first is still in
  // flight and the checkbox appears to "not take". Resynced below whenever
  // fresh server data (a new `onboarding` prop) actually arrives.
  const [local, setLocal] = useState<Onboarding>(onboarding);
  const [error, setError] = useState<string | null>(null);
  // Resync during render (React's documented pattern for "adjust state when
  // a prop changes" without an Effect) whenever a fresh `onboarding` prop
  // arrives from the server — tracked by reference, not a useEffect.
  const [prevOnboarding, setPrevOnboarding] = useState(onboarding);
  if (onboarding !== prevOnboarding) {
    setPrevOnboarding(onboarding);
    setLocal(onboarding);
  }

  async function patchOnboarding(patch: Partial<Onboarding>, rollback: Onboarding) {
    setError(null);
    try {
      await api.patch(`/api/studios/${studioId}`, { onboarding: patch });
      router.refresh();
    } catch (e) {
      setLocal(rollback);
      setError(e instanceof ApiError ? e.message : "Could not update");
    }
  }

  function toggle(key: keyof Onboarding, value: boolean) {
    const rollback = local;
    setLocal((prev) => ({ ...prev, [key]: value }));
    void patchOnboarding({ [key]: value }, rollback);
  }

  function setAll(value: boolean) {
    const rollback = local;
    const next = KEYS.reduce((acc, key) => ({ ...acc, [key]: value }), {} as Onboarding);
    setLocal(next);
    void patchOnboarding(next, rollback);
  }

  const allChecked = KEYS.every((key) => local[key]);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="card-title">Onboarding checklist</h3>
        <button type="button" onClick={() => setAll(!allChecked)} className="link-quiet py-1 text-xs">
          {allChecked ? "Clear all" : "Select all"}
        </button>
      </div>
      <ul className="space-y-1.5">
        {KEYS.map((key) => (
          <li key={key}>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={local[key]}
                onChange={(e) => toggle(key, e.target.checked)}
              />
              {LABELS[key]}
            </label>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
