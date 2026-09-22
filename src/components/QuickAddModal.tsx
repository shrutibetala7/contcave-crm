"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { Icon } from "@/components/Icon";
import { BRAND_CATEGORIES, BRAND_CATEGORY_LABELS, ENQUIRY_SOURCES, SHOOT_TYPES } from "@/lib/enums";
import {
  PARSED_FIELD_ORDER,
  type ParsedField,
  type ParsedFieldKey,
  type ParsedFields,
  type ParsedFieldsResponse,
} from "@/lib/parseEnquiryText";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Current user's id — stamped as confirmedBy on any field they confirm/edit. */
  userId: string | null;
}

const emptyField: ParsedField = { value: null, evidence: null, sourceSpan: null };

// Cast to a homogeneous shape while building — same rationale as
// verifyFieldEvidence() in parseEnquiryText.ts: every entry is the same
// empty field regardless of its per-key value type.
const emptyFields: ParsedFields = PARSED_FIELD_ORDER.reduce((acc, key) => {
  acc[key] = emptyField;
  return acc;
}, {} as Record<ParsedFieldKey, ParsedField>) as ParsedFields;

const FIELD_LABELS: Record<ParsedFieldKey, string> = {
  "contact.name": "Contact name",
  "contact.phone": "Contact phone (E.164)",
  "brand.name": "Brand / company",
  "brief.shootType": "Shoot type",
  "brief.city": "City",
  "brief.preferredLocality": "Locality",
  "brief.deliverables": "Deliverables",
  "brief.durationHours": "Duration (hours)",
  "brief.crewSize": "Crew size",
  "brief.budgetMin": "Budget min",
  "brief.budgetMax": "Budget max",
  "brief.requirements": "Requirements (comma-separated)",
  "brief.datesFlexible": "Dates flexible",
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
const TODAY_ISO = () => isoDay(new Date());

export function QuickAddModal({ open, onClose, userId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [pasteText, setPasteText] = useState("");
  const [rawText, setRawText] = useState("");
  const [fields, setFields] = useState<ParsedFields>(emptyFields);
  const [confirmedKeys, setConfirmedKeys] = useState<Set<ParsedFieldKey>>(new Set());
  const [source, setSource] = useState<(typeof ENQUIRY_SOURCES)[number]>("whatsapp");
  const [industry, setIndustry] = useState("");
  // Shoot date: flexible, or a tentative date / short range.
  const [datesFlexible, setDatesFlexible] = useState(false);
  const [shootFrom, setShootFrom] = useState("");
  const [shootTo, setShootTo] = useState("");
  // Enquiry date: distinct from createdAt — defaults to today, but backfilled
  // history needs its real date.
  const [enquiryDateToday, setEnquiryDateToday] = useState(true);
  const [enquiryDate, setEnquiryDate] = useState(TODAY_ISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc closes, like any dialog. Registered before the early return so hook order is stable.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        reset();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function reset() {
    setStep("paste");
    setPasteText("");
    setRawText("");
    setFields(emptyFields);
    setConfirmedKeys(new Set());
    setIndustry("");
    setDatesFlexible(false);
    setShootFrom("");
    setShootTo("");
    setEnquiryDateToday(true);
    setEnquiryDate(TODAY_ISO());
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleParse() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<ParsedFieldsResponse>("/api/enquiries/parse", { text: pasteText });
      setRawText(res.rawText);
      setFields(res.fields);
      setConfirmedKeys(new Set());
      setStep("review");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not parse text");
    } finally {
      setBusy(false);
    }
  }

  function skipToManual() {
    setRawText(pasteText);
    setFields(emptyFields);
    setConfirmedKeys(new Set());
    setStep("review");
  }

  /** A direct edit is a human stating the value — always unblocks the field. */
  function setValue(key: ParsedFieldKey, value: unknown) {
    const isEmpty = value === "" || value == null || (Array.isArray(value) && value.length === 0);
    setFields((prev) => ({
      ...prev,
      [key]: isEmpty ? emptyField : { value, evidence: "stated", sourceSpan: null },
    }));
    setConfirmedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key); // "stated" isn't gated by confirmedKeys — it's never blocking
      return next;
    });
  }

  function confirmField(key: ParsedFieldKey) {
    setConfirmedKeys((prev) => new Set(prev).add(key));
  }

  const blockingKeys = PARSED_FIELD_ORDER.filter(
    (key) => fields[key].evidence === "inferred" && !confirmedKeys.has(key)
  );
  const brandName = (fields["brand.name"].value as string | null)?.trim() || "";

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (blockingKeys.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const fieldEvidence: Record<string, { evidence: string; confirmedBy: string | null; confirmedAt: string | null }> = {};
      const now = new Date().toISOString();
      for (const key of PARSED_FIELD_ORDER) {
        const field = fields[key];
        if (field.evidence == null) continue;
        const humanTouched = field.evidence === "stated" || (field.evidence === "inferred" && confirmedKeys.has(key));
        fieldEvidence[key] = {
          evidence: field.evidence,
          confirmedBy: humanTouched ? userId : null,
          confirmedAt: humanTouched ? now : null,
        };
      }

      let brandId: string | undefined;
      if (brandName) {
        const brandRes = await api.post<{ data: { id: string } }>("/api/brands", { name: brandName });
        brandId = brandRes.data.id;
      }

      const contactPhone = fields["contact.phone"].value as string | null;
      let contactId: string | undefined;
      if (contactPhone) {
        const contactRes = await api.post<{ data: { id: string } }>("/api/contacts", {
          name: (fields["contact.name"].value as string | null) || "Unknown",
          phone: contactPhone,
          brandId,
        });
        contactId = contactRes.data.id;
      }

      const requirementsValue = fields["brief.requirements"].value;
      const requirements = Array.isArray(requirementsValue) ? requirementsValue : [];
      const preferredDates = datesFlexible
        ? []
        : [shootFrom, shootTo].filter(Boolean).map((d) => new Date(d).toISOString());

      const enquiryRes = await api.post<{ data: { id: string } }>("/api/enquiries", {
        source,
        brandId,
        contactId,
        // Only meaningful when there's no named brand — see the Industry field below.
        industry: brandName ? null : industry || null,
        enquiryDate: new Date(enquiryDateToday ? TODAY_ISO() : enquiryDate).toISOString(),
        brief: {
          rawText,
          shootType: fields["brief.shootType"].value,
          deliverables: fields["brief.deliverables"].value,
          city: fields["brief.city"].value,
          preferredLocality: fields["brief.preferredLocality"].value,
          preferredDates,
          datesFlexible,
          durationHours: fields["brief.durationHours"].value,
          crewSize: fields["brief.crewSize"].value,
          budgetMin: fields["brief.budgetMin"].value,
          budgetMax: fields["brief.budgetMax"].value,
          requirements,
          fieldEvidence,
        },
      });

      close();
      router.push(`/enquiries/${enquiryRes.data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save enquiry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:pt-16">
      <div role="dialog" aria-modal="true" aria-labelledby="quick-add-title" className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 id="quick-add-title" className="text-sm font-semibold text-neutral-900">Quick add enquiry</h2>
          <button onClick={close} className="rounded p-1 text-neutral-500 hover:text-neutral-900" aria-label="Close">
            <Icon name="x" className="size-4" />
          </button>
        </div>

        {step === "paste" && (
          <div className="space-y-3 p-5">
            <p className="text-sm text-neutral-500">
              Paste the WhatsApp or Instagram DM conversation. We&apos;ll pull out what we can — fields
              we&apos;re confident about are pre-filled, fields we&apos;re guessing at are flagged amber
              for you to confirm or fix.
            </p>
            <textarea
              autoFocus
              rows={10}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Hi, this is Priya from Studio Loop. We need a product shoot..."
              className="w-full rounded-md border border-neutral-300 p-3 text-sm focus:border-neutral-500 focus:outline-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-between">
              <button onClick={skipToManual} className="link-quiet text-sm">
                Skip — enter manually
              </button>
              <button
                onClick={handleParse}
                disabled={busy || !pasteText.trim()}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {busy ? "Parsing…" : "Parse"}
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <form onSubmit={handleSave} className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
            <div>
              <label className="block text-xs font-medium text-neutral-500">
                Customer query (verbatim if pasted — otherwise describe what they asked for; this is what
                later trains the parser, so the more real language, the better)
              </label>
              <textarea
                rows={3}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="What did they actually ask for?"
                className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm focus:border-neutral-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="block text-xs font-medium text-neutral-500">Enquiry date</span>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={enquiryDateToday}
                      onChange={(e) => setEnquiryDateToday(e.target.checked)}
                    />
                    Today
                  </label>
                  {!enquiryDateToday && (
                    <input
                      type="date"
                      aria-label="Enquiry date"
                      value={enquiryDate}
                      onChange={(e) => setEnquiryDate(e.target.value)}
                      className="input w-auto py-1 text-xs"
                    />
                  )}
                </div>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-neutral-500">Source</span>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as typeof source)}
                  className="input mt-1"
                >
                  {ENQUIRY_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EvidenceField
                fieldKey="contact.name"
                field={fields["contact.name"]}
                confirmed={confirmedKeys.has("contact.name")}
                onConfirm={confirmField}
              >
                <input
                  value={(fields["contact.name"].value as string) ?? ""}
                  onChange={(e) => setValue("contact.name", e.target.value)}
                  className="input"
                />
              </EvidenceField>
              <EvidenceField
                fieldKey="contact.phone"
                field={fields["contact.phone"]}
                confirmed={confirmedKeys.has("contact.phone")}
                onConfirm={confirmField}
              >
                <input
                  value={(fields["contact.phone"].value as string) ?? ""}
                  onChange={(e) => setValue("contact.phone", e.target.value)}
                  placeholder="+919876543210"
                  className="input"
                />
              </EvidenceField>
              <EvidenceField
                fieldKey="brand.name"
                field={fields["brand.name"]}
                confirmed={confirmedKeys.has("brand.name")}
                onConfirm={confirmField}
              >
                <input
                  value={(fields["brand.name"].value as string) ?? ""}
                  onChange={(e) => setValue("brand.name", e.target.value)}
                  placeholder="Leave blank if there's no company name"
                  className="input"
                />
              </EvidenceField>
              {/* Brand name if we have one; otherwise at least capture what kind of business this is. */}
              {!brandName && (
                <label className="block">
                  <span className="block text-xs font-medium text-neutral-500">Industry (no brand name given)</span>
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="input mt-1">
                    <option value="">—</option>
                    {BRAND_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {BRAND_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <EvidenceField
                fieldKey="brief.shootType"
                field={fields["brief.shootType"]}
                confirmed={confirmedKeys.has("brief.shootType")}
                onConfirm={confirmField}
              >
                <select
                  value={(fields["brief.shootType"].value as string) ?? ""}
                  onChange={(e) => setValue("brief.shootType", e.target.value || null)}
                  className="input"
                >
                  <option value="">—</option>
                  {SHOOT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </EvidenceField>
              <EvidenceField
                fieldKey="brief.city"
                field={fields["brief.city"]}
                confirmed={confirmedKeys.has("brief.city")}
                onConfirm={confirmField}
              >
                <input
                  value={(fields["brief.city"].value as string) ?? ""}
                  onChange={(e) => setValue("brief.city", e.target.value)}
                  className="input"
                />
              </EvidenceField>
              <EvidenceField
                fieldKey="brief.budgetMin"
                field={fields["brief.budgetMin"]}
                confirmed={confirmedKeys.has("brief.budgetMin")}
                onConfirm={confirmField}
              >
                <input
                  type="number"
                  value={(fields["brief.budgetMin"].value as number) ?? ""}
                  onChange={(e) => setValue("brief.budgetMin", e.target.value ? Number(e.target.value) : null)}
                  className="input"
                />
              </EvidenceField>
              <EvidenceField
                fieldKey="brief.budgetMax"
                field={fields["brief.budgetMax"]}
                confirmed={confirmedKeys.has("brief.budgetMax")}
                onConfirm={confirmField}
              >
                <input
                  type="number"
                  value={(fields["brief.budgetMax"].value as number) ?? ""}
                  onChange={(e) => setValue("brief.budgetMax", e.target.value ? Number(e.target.value) : null)}
                  className="input"
                />
              </EvidenceField>
            </div>

            <label className="block">
              <span className="block text-xs font-medium text-neutral-500">Shoot date</span>
              <div className="mt-1 space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={datesFlexible} onChange={(e) => setDatesFlexible(e.target.checked)} />
                  Dates are flexible
                </label>
                {!datesFlexible && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                    <input
                      type="date"
                      aria-label="Tentative shoot date"
                      value={shootFrom}
                      onChange={(e) => setShootFrom(e.target.value)}
                      className="input w-auto py-1 text-xs"
                    />
                    <span>to (optional, for a range)</span>
                    <input
                      type="date"
                      aria-label="End of shoot date range"
                      value={shootTo}
                      onChange={(e) => setShootTo(e.target.value)}
                      className="input w-auto py-1 text-xs"
                    />
                  </div>
                )}
              </div>
            </label>

            <EvidenceField
              fieldKey="brief.deliverables"
              field={fields["brief.deliverables"]}
              confirmed={confirmedKeys.has("brief.deliverables")}
              onConfirm={confirmField}
            >
              <input
                value={(fields["brief.deliverables"].value as string) ?? ""}
                onChange={(e) => setValue("brief.deliverables", e.target.value)}
                className="input"
              />
            </EvidenceField>

            {blockingKeys.length > 0 && (
              <p role="status" className="text-xs text-amber-800">
                {blockingKeys.length} guessed field{blockingKeys.length > 1 ? "s" : ""} need confirming before
                you can save — amber fields above.
              </p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-between border-t border-neutral-100 pt-4">
              <button
                type="button"
                onClick={() => setStep("paste")}
                className="link-quiet text-sm"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={busy || blockingKeys.length > 0}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save enquiry"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Change Brief v1.1 §A: inferred (unconfirmed) fields get an amber left
 * border, a "not stated — confirm" label and a one-click confirm — editing
 * the value directly also unblocks it (handled by the caller's onChange,
 * which reclassifies the field as "stated").
 */
function EvidenceField({
  fieldKey,
  field,
  confirmed,
  onConfirm,
  children,
}: {
  fieldKey: ParsedFieldKey;
  field: ParsedField;
  confirmed: boolean;
  onConfirm: (key: ParsedFieldKey) => void;
  children: React.ReactNode;
}) {
  const blocking = field.evidence === "inferred" && !confirmed;
  return (
    <label className={`block ${blocking ? "flag-amber-field" : ""}`}>
      <span className="flex items-center justify-between text-xs font-medium text-neutral-500">
        {FIELD_LABELS[fieldKey]}
        {blocking && (
          <button
            type="button"
            onClick={() => onConfirm(fieldKey)}
            className="text-amber-800 underline underline-offset-2 hover:text-amber-950"
          >
            not stated — confirm
          </button>
        )}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
