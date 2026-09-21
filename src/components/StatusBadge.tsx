const COLORS: Record<string, string> = {
  new: "bg-neutral-100 text-neutral-700",
  contacted: "bg-blue-50 text-blue-700",
  qualified: "bg-blue-50 text-blue-700",
  shortlist_sent: "bg-indigo-50 text-indigo-700",
  negotiating: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-emerald-50 text-emerald-700",
  delayed: "bg-orange-100 text-orange-800",
  completed: "bg-teal-50 text-teal-700",
  feedback_pending: "bg-purple-50 text-purple-700",
  closed_won: "bg-green-100 text-green-800",
  dormant: "bg-neutral-200 text-neutral-600",
  lost: "bg-red-50 text-red-700",
  // studio stages
  lead: "bg-neutral-100 text-neutral-700",
  agreement_sent: "bg-indigo-50 text-indigo-700",
  onboarding: "bg-amber-50 text-amber-700",
  active: "bg-green-100 text-green-800",
  not_interested: "bg-red-50 text-red-700",
  paused: "bg-neutral-200 text-neutral-600",
  churned: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  const color = COLORS[status] ?? "bg-neutral-100 text-neutral-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
