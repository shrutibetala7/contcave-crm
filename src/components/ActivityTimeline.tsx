"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Icon, type IconName } from "@/components/Icon";
import { api, ApiError } from "@/lib/apiClient";
import type { ActivityDoc, ActivityEntityType } from "@/types/models";

const TYPE_ICON: Record<string, { icon: IconName; label: string }> = {
  note: { icon: "note", label: "Note" },
  call: { icon: "phone", label: "Call" },
  whatsapp: { icon: "whatsapp", label: "WhatsApp" },
  email: { icon: "mail", label: "Email" },
  meeting: { icon: "users", label: "Meeting" },
  visit: { icon: "pin", label: "Visit" },
  status_change: { icon: "refresh", label: "Status change" },
  system: { icon: "clock", label: "System" },
};

export function ActivityTimeline({
  entityType,
  entityId,
  activities,
}: {
  entityType: ActivityEntityType;
  entityId: string;
  activities: ActivityDoc[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addNote() {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/activities", { entityType, entityId, type: "note", body });
      setBody("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <h3 className="mb-3 card-title">Activity</h3>
      <div className="mb-3 flex gap-2">
        <input
          aria-label="Add a note"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNote()}
          placeholder="Add a note…"
          className="input"
        />
        <button onClick={addNote} disabled={busy || !body.trim()} className="btn-secondary shrink-0">
          Add
        </button>
      </div>
      {error && <p role="alert" className="mb-2 text-xs text-red-700">{error}</p>}
      {activities.length === 0 ? (
        <p className="text-sm text-neutral-500">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {activities.map((a) => (
            <li key={a.id} className="flex gap-2 text-sm">
              <span className="mt-0.5 text-neutral-500" title={TYPE_ICON[a.type]?.label}>
                <Icon name={TYPE_ICON[a.type]?.icon ?? "note"} className="size-4" />
                <span className="sr-only">{TYPE_ICON[a.type]?.label ?? a.type}: </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-neutral-700">
                  {a.type === "status_change" && a.meta
                    ? `Moved from ${((a.meta as { from?: string }).from ?? "?").replace(/_/g, " ")} to ${((a.meta as { to?: string }).to ?? "?").replace(/_/g, " ")}`
                    : a.body || a.type}
                </p>
                {a.type === "status_change" && a.body && <p className="text-xs text-neutral-500">{a.body}</p>}
                <p className="text-xs tabular-nums text-neutral-500">{format(new Date(a.occurredAt), "d MMM, HH:mm")}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
