"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import type { UserOption } from "@/lib/users";

/** Who's working this lead — their follow-ups land on their Today. */
export function OwnerPicker({ enquiryId, ownerId, users }: { enquiryId: string; ownerId: string | null; users: UserOption[] }) {
  const router = useRouter();
  const [value, setValue] = useState(ownerId ?? "");
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setError(null);
    try {
      await api.patch(`/api/enquiries/${enquiryId}`, { ownerId: next || null });
      router.refresh();
    } catch (e) {
      setValue(previous);
      setError(e instanceof ApiError ? e.message : "Couldn't change the owner.");
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <label className="text-xs text-neutral-500" htmlFor={`owner-${enquiryId}`}>
        Owner
      </label>
      <select id={`owner-${enquiryId}`} value={value} onChange={(e) => change(e.target.value)} className="input w-auto py-1 text-xs">
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
