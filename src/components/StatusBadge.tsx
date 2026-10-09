import { ENQUIRY_STATUS_LABELS, type EnquiryStatus } from "@/lib/enums";

/**
 * Colour means something here, or it isn't used: open stages are graduated
 * greys (darker = further along), green is a booking, red is lost. Parked and
 * cancelled stay quiet — they're out of play.
 */
const COLORS: Record<string, string> = {
  // enquiry stages
  new: "bg-neutral-100 text-neutral-600",
  talking: "bg-neutral-200 text-neutral-700",
  options_sent: "bg-neutral-300 text-neutral-800",
  confirmed: "bg-green-100 text-green-800",
  done: "bg-green-100 text-green-800",
  parked: "bg-neutral-100 text-neutral-500",
  lost: "bg-red-50 text-red-700",
  cancelled: "bg-neutral-100 text-neutral-600",
  // studio stages
  not_contacted: "bg-neutral-100 text-neutral-700",
  in_progress: "bg-neutral-200 text-neutral-700",
  verified: "bg-green-100 text-green-800",
  curated: "bg-purple-50 text-purple-700",
};

export function StatusBadge({ status }: { status: string }) {
  const color = COLORS[status] ?? "bg-neutral-100 text-neutral-700";
  const label = ENQUIRY_STATUS_LABELS[status as EnquiryStatus] ?? status.replace(/_/g, " ");
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>;
}
