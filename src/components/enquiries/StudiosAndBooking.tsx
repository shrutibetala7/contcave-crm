"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { dayKey, formatShortDay } from "@/lib/businessDay";
import { COMMISSION_RATE_LABEL, commissionFor, formatINR } from "@/lib/money";
import type { EnquiryStatus, ShortlistOutcome } from "@/lib/enums";
import type { Booking, ShortlistEntryDoc } from "@/types/models";
import { celebrate } from "@/lib/celebrate";
import { StudioPicker, type StudioOption } from "@/components/enquiries/StudioPicker";

/** What the client said about each studio offered — "picked" only ever comes from Book. */
const OUTCOME_LABELS: Record<ShortlistOutcome, string> = {
  pending: "Waiting to hear",
  picked: "Chosen",
  rejected_price: "Too expensive",
  rejected_availability: "Not available",
  rejected_location: "Wrong location",
  rejected_look: "Didn't like the look",
  studio_declined: "Studio declined",
  studio_no_response: "Studio didn't reply",
};
const OUTCOME_CHOICES = (Object.keys(OUTCOME_LABELS) as ShortlistOutcome[]).filter((o) => o !== "picked");

const toKey = (d: string | Date | null | undefined) => (d ? dayKey(d) : "");
const fromKey = (key: string) => new Date(`${key}T00:00:00.000Z`).toISOString();

/**
 * The whole studio side of an enquiry in one place: the studios offered,
 * what the client said about each, and — once they choose — booking it.
 * "Book" on a studio asks for the value, the shoot date and (optionally) a
 * platform booking ID, and confirms the enquiry in the same step.
 */
export function StudiosAndBooking({
  enquiryId,
  status,
  shortlist,
  booking,
  preferredDates,
  studioOptions,
}: {
  enquiryId: string;
  status: EnquiryStatus;
  shortlist: ShortlistEntryDoc[];
  booking: Booking;
  preferredDates: string[];
  studioOptions: StudioOption[];
}) {
  const router = useRouter();
  const [bookingFor, setBookingFor] = useState<string | null>(null);
  const [studio, setStudio] = useState<StudioOption | null>(null);
  const [quote, setQuote] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const booked = status === "confirmed" || status === "completed";
  const closed = status === "lost" || status === "cancelled";
  const chosen = shortlist.find((s) => s.outcome === "picked") ?? null;
  const others = booked && chosen ? shortlist.filter((s) => s.id !== chosen.id) : shortlist;
  const areaById = new Map(studioOptions.map((s) => [s.id, s.area]));
  const onShortlist = new Set(shortlist.map((s) => s.studioId));
  const addable = studioOptions.filter((s) => !onShortlist.has(s.id));

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : fallback);
      return false;
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!studio) return;
    setAdding(true);
    const ok = await run(
      () => api.post(`/api/enquiries/${enquiryId}/shortlist`, { studioId: studio.id, quotedAmount: quote ? Number(quote) : null }),
      "Couldn't add that studio."
    );
    setAdding(false);
    if (ok) {
      setStudio(null);
      setQuote("");
    }
  }

  const row = (entry: ShortlistEntryDoc) => (
    <li key={entry.id} className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-[9rem] flex-1">
          <Link href={`/studios/${entry.studioId}`} className="text-sm font-medium text-neutral-900 hover:underline">
            {entry.studioName}
          </Link>
          <p className="text-xs text-neutral-500">
            {[areaById.get(entry.studioId), `offered ${formatShortDay(entry.sentAt)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="w-20 text-sm tabular-nums text-neutral-700">
          {entry.quotedAmount != null ? formatINR(entry.quotedAmount) : <span className="text-xs text-neutral-500">No quote</span>}
        </span>
        <select
          aria-label={`What the client said about ${entry.studioName}`}
          key={`${entry.id}-${entry.outcome}`}
          defaultValue={entry.outcome}
          onChange={(e) => run(() => api.patch(`/api/enquiries/${enquiryId}/shortlist/${entry.id}`, { outcome: e.target.value }), "Couldn't update that.")}
          className="input w-auto py-1 text-xs"
        >
          {(entry.outcome === "picked" ? (["picked", ...OUTCOME_CHOICES] as ShortlistOutcome[]) : OUTCOME_CHOICES).map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABELS[o]}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          {!closed && bookingFor !== entry.id && (
            <button type="button" onClick={() => setBookingFor(entry.id)} className={booked ? "btn-secondary btn-sm" : "btn-primary btn-sm"}>
              {booked ? "Book this instead" : "Book"}
            </button>
          )}
          {removing === entry.id ? (
            <span className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={async () => {
                  setRemoving(null);
                  await run(() => api.delete(`/api/enquiries/${enquiryId}/shortlist/${entry.id}`), "Couldn't remove it.");
                }}
                className="font-medium text-red-700 hover:underline"
              >
                Remove
              </button>
              <button type="button" onClick={() => setRemoving(null)} className="link-quiet">
                Keep
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setRemoving(entry.id)} className="link-quiet text-xs" aria-label={`Remove ${entry.studioName}`}>
              Remove
            </button>
          )}
        </div>
      </div>
      {bookingFor === entry.id && (
        <BookForm
          enquiryId={enquiryId}
          entry={entry}
          booking={booking}
          preferredDates={preferredDates}
          alreadyBooked={booked}
          sameStudio={entry.studioId === booking.studioId}
          onDone={() => {
            setBookingFor(null);
            router.refresh();
          }}
          onCancel={() => setBookingFor(null)}
        />
      )}
    </li>
  );

  return (
    <section id="booking" aria-labelledby="booking-title" className="card scroll-mt-20 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="booking-title" className="card-title">
          Studios &amp; booking
        </h3>
        {!booked && !closed && (
          <p className="text-xs text-neutral-500">Add the studios you&apos;ve offered · when they choose one, click Book</p>
        )}
      </div>

      {booked && chosen && (
        <div className="mt-3 rounded-lg bg-green-50/70 p-3 ring-1 ring-inset ring-green-200">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-green-800">
              {status === "completed" ? "Completed" : "Confirmed"} · {booking.platformBookingId ? `Platform booking ${booking.platformBookingId}` : "Booked off-platform"}
            </p>
            {bookingFor !== chosen.id && (
              <button type="button" onClick={() => setBookingFor(chosen.id)} className="link-quiet text-xs">
                Edit booking
              </button>
            )}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-neutral-900">{chosen.studioName}</p>
          <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-neutral-500">Booking value</dt>
              <dd className="tabular-nums text-neutral-900">{booking.grossValue ? formatINR(booking.grossValue) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Our commission ({COMMISSION_RATE_LABEL})</dt>
              <dd className="tabular-nums text-neutral-900">{booking.grossValue ? formatINR(commissionFor(booking)) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Shoot</dt>
              <dd className="tabular-nums text-neutral-900">
                {preferredDates.length ? preferredDates.map((d) => formatShortDay(d)).join(" – ") : "—"}
              </dd>
            </div>
          </dl>
          {status === "confirmed" && <p className="mt-2 text-xs text-neutral-600">Moves to Completed by itself after the shoot date.</p>}
          {bookingFor === chosen.id && (
            <BookForm
              enquiryId={enquiryId}
              entry={chosen}
              booking={booking}
              preferredDates={preferredDates}
              alreadyBooked
              sameStudio
              onDone={() => {
                setBookingFor(null);
                router.refresh();
              }}
              onCancel={() => setBookingFor(null)}
            />
          )}
        </div>
      )}

      {others.length > 0 && (
        <>
          {booked && chosen && <p className="mt-4 text-xs font-medium text-neutral-500">Other studios offered</p>}
          <ul className="mt-1 divide-y divide-neutral-100">{others.map(row)}</ul>
        </>
      )}
      {shortlist.length === 0 && <p className="mt-3 text-sm text-neutral-500">No studios offered yet.</p>}
      {closed && <p className="mt-2 text-xs text-neutral-500">This enquiry is closed, so it can&apos;t be booked.</p>}

      {!closed && (
        <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
          <StudioPicker options={addable} selected={studio} onSelect={setStudio} />
          <input
            aria-label="Their quote in rupees"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="Quote ₹"
            type="number"
            min={0}
            className="input w-28"
          />
          <button type="submit" disabled={adding || !studio} className="btn-secondary">
            {adding ? "Adding…" : "Add studio"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

function BookForm({
  enquiryId,
  entry,
  booking,
  preferredDates,
  alreadyBooked,
  sameStudio,
  onDone,
  onCancel,
}: {
  enquiryId: string;
  entry: ShortlistEntryDoc;
  booking: Booking;
  preferredDates: string[];
  alreadyBooked: boolean;
  sameStudio: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(
    String((sameStudio ? booking.grossValue : null) ?? entry.quotedAmount ?? "")
  );
  const [from, setFrom] = useState(toKey(preferredDates[0]));
  const [to, setTo] = useState(toKey(preferredDates[1]));
  const [platformId, setPlatformId] = useState(sameStudio ? booking.platformBookingId ?? "" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(value);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!(amount > 0)) return setError("Enter what the booking is worth.");
    if (!from) return setError("Add the shoot date.");
    if (to && to < from) return setError("The last shoot day can't be before the first.");
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/enquiries/${enquiryId}/booking`, {
        shortlistEntryId: entry.id,
        grossValue: amount,
        platformBookingId: platformId.trim() || null,
        shootDates: [from, to].filter((d, i) => d && !(i === 1 && d === from)).map(fromKey),
      });
      onDone();
      if (!alreadyBooked) celebrate(); // a new booking, not an edit to an existing one
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-sm font-medium text-neutral-900">
        {alreadyBooked && sameStudio ? "Edit booking" : `Book ${entry.studioName}`}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-xs text-neutral-600">
          Booking value (₹)
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            className="input mt-1"
          />
          <span className="mt-1 block text-neutral-500">
            Our commission: <span className="tabular-nums text-neutral-700">{amount > 0 ? formatINR(commissionFor({ grossValue: amount })) : "—"}</span>
          </span>
        </label>
        <label className="block text-xs text-neutral-600">
          Shoot date
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input mt-1" />
        </label>
        <label className="block text-xs text-neutral-600">
          Last day <span className="text-neutral-500">(if more than one)</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="input mt-1" />
        </label>
      </div>
      <label className="block text-xs text-neutral-600">
        Platform booking ID <span className="text-neutral-500">(leave empty if it was booked off-platform)</span>
        <input value={platformId} onChange={(e) => setPlatformId(e.target.value)} className="input mt-1 sm:w-1/2" />
      </label>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Saving…" : alreadyBooked ? "Save booking" : "Confirm booking"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="link-quiet text-sm">
          Cancel
        </button>
        {!alreadyBooked && <span className="text-xs text-neutral-500">Marks the enquiry Confirmed and the lead a customer.</span>}
      </div>
    </form>
  );
}
