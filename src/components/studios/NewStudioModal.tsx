"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { Icon } from "@/components/Icon";
import { STUDIO_CATEGORIES } from "@/lib/enums";

export function NewStudioModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggleCategory(c: string) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ data: { id: string } }>("/api/studios", {
        name,
        city: city || null,
        categories,
        contacts:
          contactName && contactPhone ? [{ name: contactName, phone: contactPhone, isPrimary: true }] : [],
      });
      onClose();
      router.push(`/studios/${res.data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create studio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:pt-16">
      <div role="dialog" aria-modal="true" aria-labelledby="new-studio-title" className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 id="new-studio-title" className="text-sm font-semibold text-neutral-900">New studio</h2>
          <button onClick={onClose} className="rounded p-1 text-neutral-500 hover:text-neutral-900" aria-label="Close">
            <Icon name="x" className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <label className="block text-xs text-neutral-500">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" autoFocus />
          </label>
          <label className="block text-xs text-neutral-500">
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} className="input mt-1" />
          </label>
          <div>
            <span className="block text-xs text-neutral-500">Categories</span>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
              {STUDIO_CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm capitalize text-neutral-700">
                  <input type="checkbox" checked={categories.includes(c)} onChange={() => toggleCategory(c)} />
                  {c}
                </label>
              ))}
            </div>
          </div>
          <label className="block text-xs text-neutral-500">
            Primary contact name
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="input mt-1" />
          </label>
          <label className="block text-xs text-neutral-500">
            Primary contact phone
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+919876543210"
              className="input mt-1"
            />
          </label>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <button onClick={submit} disabled={busy || !name.trim()} className="btn-primary w-full">
            {busy ? "Saving…" : "Create studio"}
          </button>
        </div>
      </div>
    </div>
  );
}
