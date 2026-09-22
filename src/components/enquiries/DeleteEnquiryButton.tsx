"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";

/** A destructive, rarely-used action — kept small and out of the way, with a confirm step. */
export function DeleteEnquiryButton({ enquiryId, code }: { enquiryId: string; code: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/enquiries/${enquiryId}`);
      router.push("/enquiries");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete");
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
        <span className="text-red-800">Delete {code}? This can&apos;t be undone.</span>
        <button onClick={del} disabled={busy} className="font-medium text-red-700 underline hover:text-red-900">
          {busy ? "Deleting…" : "Delete"}
        </button>
        <button onClick={() => setConfirming(false)} disabled={busy} className="link-quiet">
          Cancel
        </button>
        {error && (
          <span role="alert" className="text-red-700">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="link-quiet text-xs">
      Delete enquiry
    </button>
  );
}
