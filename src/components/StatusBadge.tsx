const COLORS: Record<string, string> = {
  // enquiry statuses
  new_lead: "bg-neutral-100 text-neutral-700",
  in_progress: "bg-blue-50 text-blue-700",
  confirmed: "bg-green-100 text-green-800",
  on_hold: "bg-amber-50 text-amber-700",
  cancelled: "bg-orange-100 text-orange-800",
  lost: "bg-red-50 text-red-700",
  dormant: "bg-neutral-200 text-neutral-600",
  // studio statuses
  not_contacted: "bg-neutral-100 text-neutral-700",
  verified: "bg-green-100 text-green-800",
  curated: "bg-purple-50 text-purple-700",
};

export function StatusBadge({ status }: { status: string }) {
  const color = COLORS[status] ?? "bg-neutral-100 text-neutral-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
