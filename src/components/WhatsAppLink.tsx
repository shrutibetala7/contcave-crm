import { Icon } from "@/components/Icon";
import { whatsappLink } from "@/lib/whatsapp";

export function WhatsAppLink({
  phone,
  message,
  className,
  children,
}: {
  phone: string | null | undefined;
  message?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  if (!phone) return <span className="text-xs text-neutral-500">No phone</span>;
  return (
    <a
      href={whatsappLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={children ? undefined : `Open WhatsApp chat with ${phone}`}
      className={
        className ??
        "inline-flex items-center gap-1 rounded text-green-700 transition-colors hover:text-green-800 hover:underline"
      }
    >
      {children ?? (
        <>
          <Icon name="whatsapp" className="size-3.5" /> WhatsApp
        </>
      )}
    </a>
  );
}
