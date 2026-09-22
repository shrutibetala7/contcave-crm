"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/apiClient";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { STUDIO_CATEGORIES } from "@/lib/enums";
import type { StudioDoc } from "@/types/models";

type Contact = StudioDoc["contacts"][number];

interface Draft {
  name: string;
  city: string;
  locality: string;
  categories: string[];
  notes: string;
  contacts: Contact[];
  contcaveUrl: string;
}

const emptyContact: Contact = { name: "", phone: "", isPrimary: false };

export function StudioDetails({
  studioId,
  name,
  city,
  locality,
  categories,
  notes,
  contacts,
  contcaveUrl,
}: {
  studioId: string;
  name: string;
  city: string | null | undefined;
  locality: string | null | undefined;
  categories: string[];
  notes: string | null | undefined;
  contacts: Contact[];
  contcaveUrl: string | null | undefined;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setError(null);
    setDraft({
      name,
      city: city ?? "",
      locality: locality ?? "",
      categories,
      notes: notes ?? "",
      contacts: contacts.length ? contacts : [{ ...emptyContact }],
      contcaveUrl: contcaveUrl ?? "",
    });
  }

  function patch(part: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...part } : d));
  }

  function setContact(index: number, part: Partial<Contact>) {
    if (!draft) return;
    patch({ contacts: draft.contacts.map((c, i) => (i === index ? { ...c, ...part } : c)) });
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError("A studio needs a name.");
      return;
    }
    // A half-filled contact is almost always a slip; a fully empty row is just unused.
    const filled = draft.contacts.filter((c) => c.name.trim() || c.phone.trim());
    if (filled.some((c) => !c.name.trim() || !c.phone.trim())) {
      setError("Each contact needs both a name and a phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/studios/${studioId}`, {
        name: draft.name.trim(),
        city: draft.city.trim() || null,
        locality: draft.locality.trim() || null,
        categories: draft.categories,
        notes: draft.notes.trim() || null,
        contcaveUrl: draft.contcaveUrl.trim() || null,
        // The first contact is the primary one — no separate "primary" control to manage.
        contacts: filled.map((c, i) => ({ ...c, name: c.name.trim(), phone: c.phone.trim(), isPrimary: i === 0 })),
      });
      setDraft(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (!draft) {
    return (
      <div className="card space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="card-title">Details</h3>
          <button onClick={startEdit} className="link-quiet py-1 text-xs">
            Edit
          </button>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">Location</dt>
            <dd className="text-neutral-800">{[locality, city].filter(Boolean).join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Categories</dt>
            <dd className="capitalize text-neutral-800">{categories.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">ContCave listing</dt>
            <dd className="text-neutral-800">
              {contcaveUrl ? (
                <a href={contcaveUrl} target="_blank" rel="noopener noreferrer" className="link-quiet text-neutral-900">
                  View listing ↗
                </a>
              ) : (
                <span className="text-neutral-500">Not listed yet</span>
              )}
            </dd>
          </div>
          {notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-neutral-500">Notes</dt>
              <dd className="whitespace-pre-wrap text-neutral-700">{notes}</dd>
            </div>
          )}
        </dl>
        <div>
          <p className="mb-1 text-xs text-neutral-500">Contacts</p>
          {contacts.length === 0 ? (
            <p className="text-sm text-neutral-500">No contacts yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {contacts.map((c, i) => (
                <li key={`${c.phone}-${i}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm">
                  <span className="text-neutral-900">
                    {c.name}
                    {i === 0 && contacts.length > 1 && <span className="ml-2 text-xs text-neutral-500">primary</span>}
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="tabular-nums text-neutral-600">{c.phone}</span>
                    <WhatsAppLink phone={c.phone} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-4">
      <h3 className="card-title">Edit details</h3>
      <label className="block text-xs text-neutral-600">
        Name
        <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} className="input mt-1" autoFocus />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs text-neutral-600">
          City
          <input value={draft.city} onChange={(e) => patch({ city: e.target.value })} className="input mt-1" />
        </label>
        <label className="block text-xs text-neutral-600">
          Locality
          <input value={draft.locality} onChange={(e) => patch({ locality: e.target.value })} className="input mt-1" />
        </label>
      </div>
      <label className="block text-xs text-neutral-600">
        ContCave listing URL (optional — once the studio is live on contcave.com)
        <input
          value={draft.contcaveUrl}
          onChange={(e) => patch({ contcaveUrl: e.target.value })}
          placeholder="https://contcave.com/studios/..."
          className="input mt-1"
        />
      </label>
      <fieldset>
        <legend className="text-xs text-neutral-600">Categories</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
          {STUDIO_CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-sm capitalize text-neutral-700">
              <input
                type="checkbox"
                checked={draft.categories.includes(c)}
                onChange={() =>
                  patch({
                    categories: draft.categories.includes(c) ? draft.categories.filter((x) => x !== c) : [...draft.categories, c],
                  })
                }
              />
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-xs text-neutral-600">
        Notes
        <textarea value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} rows={3} className="input mt-1" />
      </label>

      <fieldset>
        <legend className="text-xs text-neutral-600">Contacts (the first one is primary)</legend>
        <div className="mt-1 space-y-2">
          {draft.contacts.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                aria-label={`Contact ${i + 1} name`}
                value={c.name}
                onChange={(e) => setContact(i, { name: e.target.value })}
                placeholder="Name"
                className="input min-w-[9rem] flex-1"
              />
              <input
                aria-label={`Contact ${i + 1} phone`}
                value={c.phone}
                onChange={(e) => setContact(i, { phone: e.target.value })}
                placeholder="+919876543210"
                className="input min-w-[9rem] flex-1"
              />
              <button
                type="button"
                onClick={() => patch({ contacts: draft.contacts.filter((_, j) => j !== i) })}
                className="link-quiet py-1 text-xs"
                aria-label={`Remove contact ${i + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => patch({ contacts: [...draft.contacts, { ...emptyContact }] })} className="link-quiet mt-2 py-1 text-xs">
          + Add contact
        </button>
      </fieldset>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setDraft(null)} disabled={busy} className="link-quiet text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
