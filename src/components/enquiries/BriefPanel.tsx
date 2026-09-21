"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import type { Brief, FieldEvidence } from "@/types/models";

/** Amber marker + confirm action for any field still "inferred" with no confirmedBy. */
function isUnconfirmed(evidence?: FieldEvidence): boolean {
  return evidence?.evidence === "inferred" && !evidence.confirmedBy;
}

function Row({
  label,
  value,
  unconfirmed,
  onConfirm,
}: {
  label: string;
  value: React.ReactNode;
  unconfirmed: boolean;
  onConfirm?: () => void;
}) {
  if (value == null || value === "") return null;
  return (
    <div className={unconfirmed ? "flag-amber-field" : ""}>
      <dt className="flex items-center justify-between text-xs text-neutral-500">
        {label}
        {unconfirmed && onConfirm && (
          <button type="button" onClick={onConfirm} className="text-amber-800 underline underline-offset-2 hover:text-amber-950">
            not stated — confirm
          </button>
        )}
      </dt>
      <dd className="text-sm text-neutral-800">{value}</dd>
    </div>
  );
}

export function BriefPanel({ enquiryId, brief }: { enquiryId: string; brief: Brief }) {
  const router = useRouter();
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const evidence = brief.fieldEvidence ?? {};

  async function confirm(path: string) {
    setBusyPath(path);
    try {
      await api.post(`/api/enquiries/${enquiryId}/confirm-field`, { path });
      router.refresh();
    } catch (e) {
      // Non-fatal — just surfaces nothing and leaves the marker; the user can retry.
      console.error(e instanceof ApiError ? e.message : e);
    } finally {
      setBusyPath(null);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <div>
        <h3 className="mb-1 card-title">
          Brief (verbatim)
        </h3>
        <p className="whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">
          {brief.rawText}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Row
          label="Shoot type"
          value={brief.shootType}
          unconfirmed={isUnconfirmed(evidence["brief.shootType"])}
          onConfirm={busyPath ? undefined : () => confirm("brief.shootType")}
        />
        <Row label="City" value={[brief.city, brief.preferredLocality].filter(Boolean).join(", ")} unconfirmed={isUnconfirmed(evidence["brief.city"])} onConfirm={busyPath ? undefined : () => confirm("brief.city")} />
        <Row
          label="Deliverables"
          value={brief.deliverables}
          unconfirmed={isUnconfirmed(evidence["brief.deliverables"])}
          onConfirm={busyPath ? undefined : () => confirm("brief.deliverables")}
        />
        <Row label="Duration" value={brief.durationHours ? `${brief.durationHours}h` : null} unconfirmed={false} />
        <Row label="Crew size" value={brief.crewSize} unconfirmed={false} />
        <Row
          label="Budget"
          value={
            brief.budgetMin || brief.budgetMax
              ? `₹${(brief.budgetMin ?? 0).toLocaleString("en-IN")} – ₹${(brief.budgetMax ?? 0).toLocaleString("en-IN")}`
              : null
          }
          unconfirmed={isUnconfirmed(evidence["brief.budgetMin"]) || isUnconfirmed(evidence["brief.budgetMax"])}
          onConfirm={
            busyPath
              ? undefined
              : () => {
                  confirm("brief.budgetMin");
                  confirm("brief.budgetMax");
                }
          }
        />
        <Row
          label="Dates flexible"
          value={brief.datesFlexible ? "Yes" : null}
          unconfirmed={isUnconfirmed(evidence["brief.datesFlexible"])}
          onConfirm={busyPath ? undefined : () => confirm("brief.datesFlexible")}
        />
        <Row
          label="Requirements"
          value={brief.requirements.length ? brief.requirements.join(", ") : null}
          unconfirmed={isUnconfirmed(evidence["brief.requirements"])}
          onConfirm={busyPath ? undefined : () => confirm("brief.requirements")}
        />
      </dl>
    </div>
  );
}
