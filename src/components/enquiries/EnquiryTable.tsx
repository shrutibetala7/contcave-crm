import Link from "next/link";
import { format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import type { EnquiryDoc } from "@/types/models";
import type { ContactMongo } from "@/lib/db/collections";

function NextAction({ date, reason }: { date: Date | string | null | undefined; reason: string | null | undefined }) {
  if (!date) return <span className="text-neutral-500">—</span>;
  return (
    <div className="min-w-0">
      <p className="font-medium tabular-nums text-neutral-800">{format(new Date(date), "d MMM")}</p>
      {reason ? (
        <p className="max-w-[16rem] truncate text-xs text-neutral-500" title={reason}>
          {reason}
        </p>
      ) : (
        <p className="text-xs text-amber-800">No reason recorded</p>
      )}
    </div>
  );
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
    const brand = e.brandId ? brandById.get(e.brandId) : undefined;
    return {
      e,
      contact,
      name: brand ?? contact?.name ?? e.code,
      sub: [e.code, brand && contact?.name].filter(Boolean).join(" · "),
      brief: [e.brief.shootType, e.brief.city].filter(Boolean).join(" · "),
      owner: e.ownerId ? userById.get(e.ownerId) : undefined,
    };
  });

  return (
    <>
      {/* Phones: one stacked card per enquiry instead of a 720px-wide table. */}
      <ul className="card divide-y divide-neutral-100 sm:hidden">
        {rows.map(({ e, contact, name, sub, brief }) => (
          <li key={e.id} className="relative px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/enquiries/${e.id}`} className="block truncate text-sm font-medium text-neutral-900 after:absolute after:inset-0">
                  {name}
                </Link>
                <p className="truncate text-xs text-neutral-500">{sub}</p>
              </div>
              <StatusBadge status={e.status} />
            </div>
            {brief && <p className="mt-1 text-xs capitalize text-neutral-600">{brief}</p>}
            <div className="mt-2 flex items-end justify-between gap-3 text-sm">
              <NextAction date={e.nextActionDate} reason={e.nextActionReason} />
              <span className="relative z-10">
                <WhatsAppLink phone={contact?.whatsappNumber} className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline" />
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
              <th scope="col" className="px-4 py-2 font-medium">Next action</th>
              <th scope="col" className="px-4 py-2 font-medium">Owner</th>
              <th scope="col" className="px-4 py-2"><span className="sr-only">Chat</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, contact, name, sub, brief, owner }) => (
              <tr key={e.id} className="relative border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                <td className="px-4 py-2.5">
                  <Link href={`/enquiries/${e.id}`} className="font-medium text-neutral-900 after:absolute after:inset-0 hover:underline">
                    {name}
                  </Link>
                  <p className="text-xs text-neutral-500">{sub}</p>
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={e.status} />
                </td>
                <td className="px-4 py-2.5 capitalize text-neutral-600">{brief || <span className="text-neutral-500">—</span>}</td>
                <td className="px-4 py-2.5">
                  <NextAction date={e.nextActionDate} reason={e.nextActionReason} />
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{owner ?? <span className="text-neutral-500">—</span>}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className="relative z-10">
                    <WhatsAppLink phone={contact?.whatsappNumber} className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline" />
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
