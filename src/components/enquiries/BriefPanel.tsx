"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
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

/** A single tentative date, a short range, or "Flexible" — whichever was actually set. */
function formatShootDate(flexible: boolean, dates: (Date | string)[]): string {
  if (flexible) return "Flexible";
  if (!dates || dates.length === 0) return "Not set";
  const sorted = [...dates].map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  if (sorted.length === 1) return format(sorted[0], "d MMM yyyy");
  return `${format(sorted[0], "d MMM")} – ${format(sorted[sorted.length - 1], "d MMM yyyy")}`;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * When the enquiry actually came in — distinct from `createdAt` (when the
 * CRM record was made), so backfilled history keeps its real date. Defaults
 * to "today" via the checkbox; unchecking it reveals a date picker.
 */
function EnquiryDateRow({ enquiryId, enquiryDate }: { enquiryId: string; enquiryDate: string | Date | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [useToday, setUseToday] = useState(true);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setError(null);
    const current = enquiryDate ? new Date(enquiryDate) : new Date();
    const iso = isoDay(current);
    setUseToday(iso === isoDay(new Date()));
    setDate(iso);
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const value = useToday ? new Date() : new Date(date);
      await api.patch(`/api/enquiries/${enquiryId}`, { enquiryDate: value.toISOString() });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <dt className="flex items-center justify-between text-xs text-neutral-500">
        Enquiry date
        <button type="button" onClick={editing ? () => setEditing(false) : startEdit} className="link-quiet">
          {editing ? "Cancel" : "Edit"}
        </button>
      </dt>
      {editing ? (
        <div className="mt-1 space-y-1.5">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={useToday} onChange={(e) => setUseToday(e.target.checked)} />
            Today
          </label>
          {!useToday && (
            <input
              type="date"
              aria-label="Enquiry date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input w-auto py-1 text-xs"
            />
          )}
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
          <button onClick={save} disabled={busy} className="btn-secondary btn-sm">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      ) : (
        <dd className="text-sm text-neutral-800">{enquiryDate ? format(new Date(enquiryDate), "d MMM yyyy") : "Not set"}</dd>
      )}
    </div>
  );
}

export function BriefPanel({
  enquiryId,
  enquiryDate,
  brief,
}: {
  enquiryId: string;
  enquiryDate: string | Date | null;
  brief: Brief;
}) {
  const router = useRouter();
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [editingDates, setEditingDates] = useState(false);
  const [flexible, setFlexible] = useState(brief.datesFlexible);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [savingDates, setSavingDates] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
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

  function startEditDates() {
    setDateError(null);
    setFlexible(brief.datesFlexible);
    const [d0, d1] = brief.preferredDates ?? [];
    setDateFrom(d0 ? new Date(d0).toISOString().slice(0, 10) : "");
    setDateTo(d1 ? new Date(d1).toISOString().slice(0, 10) : "");
    setEditingDates(true);
  }

  async function saveDates() {
    const preferredDates = flexible
      ? []
      : [dateFrom, dateTo].filter(Boolean).map((d) => new Date(d).toISOString());
    if (!flexible && preferredDates.length === 0) {
      setDateError("Add a date, or mark it flexible.");
      return;
    }
    setSavingDates(true);
    setDateError(null);
    try {
      await api.patch(`/api/enquiries/${enquiryId}`, { brief: { datesFlexible: flexible, preferredDates } });
      setEditingDates(false);
      router.refresh();
    } catch (e) {
      setDateError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSavingDates(false);
    }
  }

  const datesUnconfirmed = isUnconfirmed(evidence["brief.datesFlexible"]);

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
        <EnquiryDateRow enquiryId={enquiryId} enquiryDate={enquiryDate} />
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

        <div className={datesUnconfirmed && !editingDates ? "flag-amber-field" : ""}>
          <dt className="flex items-center justify-between text-xs text-neutral-500">
            Shoot date
            <span className="flex items-center gap-2">
              {datesUnconfirmed && !editingDates && (
                <button
                  type="button"
                  onClick={busyPath ? undefined : () => confirm("brief.datesFlexible")}
                  className="text-amber-800 underline underline-offset-2 hover:text-amber-950"
                >
                  not stated — confirm
                </button>
              )}
              <button type="button" onClick={editingDates ? () => setEditingDates(false) : startEditDates} className="link-quiet">
                {editingDates ? "Cancel" : "Edit"}
              </button>
            </span>
          </dt>
          {editingDates ? (
            <div className="mt-1 space-y-1.5">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} />
                Dates are flexible
              </label>
              {!flexible && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                  <input
                    type="date"
                    aria-label="Tentative shoot date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="input w-auto py-1 text-xs"
                  />
                  <span>to (optional, for a range)</span>
                  <input
                    type="date"
                    aria-label="End of shoot date range"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="input w-auto py-1 text-xs"
                  />
                </div>
              )}
              {dateError && (
                <p role="alert" className="text-xs text-red-700">
                  {dateError}
                </p>
              )}
              <button onClick={saveDates} disabled={savingDates} className="btn-secondary btn-sm">
                {savingDates ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <dd className="text-sm text-neutral-800">{formatShootDate(brief.datesFlexible, brief.preferredDates)}</dd>
          )}
        </div>

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
