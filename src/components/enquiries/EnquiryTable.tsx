import Link from "next/link";
import { format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";
import { ContactLinks } from "@/components/ContactLinks";
import { enquiryDisplayName } from "@/lib/enquiryDisplayName";
import { formatShortDay } from "@/lib/businessDay";
import type { EnquiryDoc } from "@/types/models";
import type { ContactMongo } from "@/lib/db/collections";

function NextFollowUp({ followUp }: { followUp: EnquiryDoc["followUp"] }) {
  if (!followUp) return <span className="text-neutral-500">—</span>;
  return (
    <div className="min-w-0">
      <p className="font-medium tabular-nums text-neutral-800">{format(new Date(followUp.dueAt), "d MMM")}</p>
      <p className="max-w-[16rem] truncate text-xs text-neutral-500" title={followUp.label}>
        {followUp.label}
      </p>
    </div>
  );
}

/** "12 Oct" / "12 – 14 Oct" — the date the studio has to be free, which is what everything hangs on. */
function shootDates(dates: (Date | string)[]): string | null {
  if (!dates.length) return null;
  const sorted = dates.map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  const first = formatShortDay(sorted[0]);
  const last = formatShortDay(sorted[sorted.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

export function EnquiryTable({
  enquiries,
  contactById,
  brandById,
  userById,
  hasFilters,
}: {
  enquiries: EnquiryDoc[];
  contactById: Map<string, ContactMongo>;
  brandById: Map<string, string>;
  userById: Map<string, string>;
  hasFilters: boolean;
}) {
  if (enquiries.length === 0) {
    return (
      <div className="card px-4 py-10 text-center">
        <p className="text-sm font-medium text-neutral-900">
          {hasFilters ? "No enquiries match these filters." : "No enquiries yet."}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {hasFilters ? (
            "Try clearing a filter."
          ) : (
            <>
              Copy a WhatsApp or Instagram chat, press <span className="kbd">C</span> and paste it — the details are
              pulled out for you.
            </>
          )}
        </p>
      </div>
    );
  }

  const rows = enquiries.map((e) => {
    const contact = e.contactId ? contactById.get(e.contactId) : undefined;
    // Who it is, then their company or industry — the code is just an identifier, kept tiny.
    const { title: name, subtitle: company } = enquiryDisplayName({
      code: e.code,
      contactName: contact?.name,
      brandName: e.brandId ? brandById.get(e.brandId) : null,
      instagramHandle: contact?.instagramHandle,
      phone: contact?.phone,
      industry: e.industry ?? null,
    });
    return {
      e,
      contact,
      name,
      company: company === e.code ? null : company,
      showCode: name !== e.code,
      brief: [e.brief.shootType, e.brief.city].filter(Boolean).join(" · "),
      shoot: shootDates(e.brief.preferredDates),
      owner: e.ownerId ? userById.get(e.ownerId) : undefined,
    };
  });

  return (
    <>
      {/* Phones: one stacked card per enquiry instead of a 720px-wide table. */}
      <ul className="card divide-y divide-neutral-100 sm:hidden">
        {rows.map(({ e, contact, name, company, showCode, brief, shoot }) => (
          <li key={e.id} className="relative px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/enquiries/${e.id}`} className="block truncate text-sm font-medium text-neutral-900 after:absolute after:inset-0">
                  {name}
                </Link>
                {company && <p className="truncate text-xs text-neutral-500">{company}</p>}
                {showCode && <p className="text-[10px] tabular-nums text-neutral-400">{e.code}</p>}
              </div>
              <StatusBadge status={e.status} />
            </div>
            {(brief || shoot) && (
              <p className="mt-1 text-xs text-neutral-600">
                <span className="capitalize">{brief}</span>
                {brief && shoot && " · "}
                {shoot && <span className="tabular-nums">Shoot {shoot}</span>}
              </p>
            )}
            <div className="mt-2 flex items-end justify-between gap-3 text-sm">
              <NextFollowUp followUp={e.followUp} />
              <span className="relative z-10">
                <ContactLinks phone={contact?.whatsappNumber ?? contact?.phone} instagramHandle={contact?.instagramHandle} compact />
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="card hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th scope="col" className="px-4 py-2 font-medium">Enquiry</th>
              <th scope="col" className="px-4 py-2 font-medium">Status</th>
              <th scope="col" className="px-4 py-2 font-medium">Brief</th>
              <th scope="col" className="px-4 py-2 font-medium">Shoot</th>
              <th scope="col" className="px-4 py-2 font-medium">Next follow-up</th>
              <th scope="col" className="px-4 py-2 font-medium">Owner</th>
              <th scope="col" className="px-4 py-2"><span className="sr-only">Chat</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, contact, name, company, showCode, brief, shoot, owner }) => (
              <tr key={e.id} className="relative border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                <td className="px-4 py-2.5">
                  <Link href={`/enquiries/${e.id}`} className="font-medium text-neutral-900 after:absolute after:inset-0 hover:underline">
                    {name}
                  </Link>
                  {company && <p className="text-xs text-neutral-500">{company}</p>}
                  {showCode && <p className="text-[10px] tabular-nums text-neutral-400">{e.code}</p>}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={e.status} />
                </td>
                <td className="px-4 py-2.5 capitalize text-neutral-600">{brief || <span className="text-neutral-500">—</span>}</td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-neutral-700">{shoot ?? <span className="text-neutral-500">—</span>}</td>
                <td className="px-4 py-2.5">
                  <NextFollowUp followUp={e.followUp} />
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{owner ?? <span className="text-neutral-500">—</span>}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className="relative z-10">
                    <ContactLinks phone={contact?.whatsappNumber ?? contact?.phone} instagramHandle={contact?.instagramHandle} compact />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
