import { Icon } from "@/components/Icon";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { instagramProfileUrl } from "@/lib/instagram";

const LINK = "inline-flex items-center gap-1 rounded text-xs transition-colors hover:underline";

export function InstagramLink({ handle, className }: { handle: string; className?: string }) {
  return (
    <a
      href={instagramProfileUrl(handle)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open @${handle} on Instagram`}
      className={className ?? `${LINK} text-pink-700 hover:text-pink-800`}
    >
      <Icon name="instagram" className="size-3.5" /> Instagram
    </a>
  );
}

/**
 * The ways to reach this person, one tap each. `compact` shows only the
 * best one (WhatsApp over Instagram) for tight rows and cards.
 */
export function ContactLinks({
  phone,
  instagramHandle,
  compact = false,
}: {
  phone: string | null | undefined;
  instagramHandle: string | null | undefined;
  compact?: boolean;
}) {
  const whatsapp = phone ? <WhatsAppLink phone={phone} className={`${LINK} text-green-700 hover:text-green-800`} /> : null;
  const instagram = instagramHandle ? <InstagramLink handle={instagramHandle} /> : null;
  if (!whatsapp && !instagram) return <span className="text-xs text-neutral-500">No contact</span>;
  if (compact) return whatsapp ?? instagram;
  return (
    <span className="inline-flex items-center gap-3">
      {whatsapp}
      {instagram}
    </span>
  );
}
