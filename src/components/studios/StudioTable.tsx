import Link from "next/link";
import { format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import type { StudioDoc } from "@/types/models";

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

export function StudioTable({ studios, hasFilters }: { studios: StudioDoc[]; hasFilters: boolean }) {
  if (studios.length === 0) {
    return (
      <div className="card px-4 py-10 text-center">
        <p className="text-sm font-medium text-neutral-900">
          {hasFilters ? "No studios match these filters." : "No studios yet."}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {hasFilters ? "Try clearing a filter." : "Use “New studio” to add the first one and start its onboarding checklist."}
        </p>
      </div>
    );
  }

  const rows = studios.map((s) => ({
    s,
    primary: s.contacts.find((c) => c.isPrimary) ?? s.contacts[0],
    place: [s.locality, s.city].filter(Boolean).join(", "),
  }));

  return (
    <>
      <ul className="card divide-y divide-neutral-100 sm:hidden">
        {rows.map(({ s, primary, place }) => (
          <li key={s.id} className="relative px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/studios/${s.id}`} className="block truncate text-sm font-medium text-neutral-900 after:absolute after:inset-0">
                  {s.name}
                </Link>
                <p className="truncate text-xs text-neutral-500">{place || "No location"}</p>
              </div>
              <StatusBadge status={s.stage} />
            </div>
            <div className="mt-2 flex items-end justify-between gap-3 text-sm">
              <NextAction date={s.nextActionDate} reason={s.nextActionReason} />
              <span className="relative z-10">
                <WhatsAppLink phone={primary?.phone} className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline" />
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="card hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th scope="col" className="px-4 py-2 font-medium">Studio</th>
              <th scope="col" className="px-4 py-2 font-medium">Stage</th>
              <th scope="col" className="px-4 py-2 font-medium">Tier</th>
              <th scope="col" className="px-4 py-2 font-medium">Next action</th>
              <th scope="col" className="px-4 py-2"><span className="sr-only">Chat</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, primary, place }) => (
              <tr key={s.id} className="relative border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                <td className="px-4 py-2.5">
                  <Link href={`/studios/${s.id}`} className="font-medium text-neutral-900 after:absolute after:inset-0 hover:underline">
                    {s.name}
                  </Link>
                  <p className="text-xs text-neutral-500">{place || "No location"}</p>
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={s.stage} />
                </td>
                <td className="px-4 py-2.5 capitalize text-neutral-600">{s.tier ?? <span className="text-neutral-500">—</span>}</td>
                <td className="px-4 py-2.5">
                  <NextAction date={s.nextActionDate} reason={s.nextActionReason} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="relative z-10">
                    <WhatsAppLink phone={primary?.phone} className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline" />
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
