"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import type { Booking } from "@/types/models";

export function BookingPanel({ enquiryId, booking }: { enquiryId: string; booking: Booking }) {
  const router = useRouter();
  const [offPlatform, setOffPlatform] = useState(booking.offPlatform);
  const [platformBookingId, setPlatformBookingId] = useState(booking.platformBookingId ?? "");
  const [grossValue, setGrossValue] = useState(booking.grossValue?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/enquiries/${enquiryId}`, {
        booking: {
          offPlatform,
          platformBookingId: offPlatform ? null : platformBookingId || null,
          grossValue: grossValue ? Number(grossValue) : null,
        },
      });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save booking");
    } finally {
      setBusy(false);
    }
  }

  const hasBooking = booking.offPlatform || booking.platformBookingId;

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="card-title">Booking</h3>
        <button onClick={() => setEditing((v) => !v)} className="text-xs text-neutral-500 hover:text-neutral-900">
          {editing ? "Cancel" : hasBooking ? "Edit" : "+ Set booking"}
        </button>
      </div>

      {!editing && (
        <p className="text-sm text-neutral-700">
          {hasBooking
            ? booking.offPlatform
              ? `Off-platform${booking.grossValue ? ` · ₹${booking.grossValue.toLocaleString("en-IN")}` : ""}`
              : `Platform booking ${booking.platformBookingId}${booking.grossValue ? ` · ₹${booking.grossValue.toLocaleString("en-IN")}` : ""}`
            : "Not booked yet — required before moving to confirmed."}
        </p>
      )}

      {editing && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={offPlatform} onChange={(e) => setOffPlatform(e.target.checked)} />
            Closed off-platform
          </label>
          {!offPlatform && (
            <label className="block text-xs text-neutral-500">
              Platform booking ID
              <input
                value={platformBookingId}
                onChange={(e) => setPlatformBookingId(e.target.value)}
                className="input mt-1"
              />
            </label>
          )}
          <label className="block text-xs text-neutral-500">
            Gross value (₹)
            <input
              type="number"
              value={grossValue}
              onChange={(e) => setGrossValue(e.target.value)}
              className="input mt-1"
            />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save booking"}
          </button>
        </div>
      )}
    </div>
  );
}
