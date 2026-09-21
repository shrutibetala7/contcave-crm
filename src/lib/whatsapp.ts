/**
 * "Every contact and studio row renders https://wa.me/<E164 without +>.
 * One tap from the record to the conversation." — spec §6.
 */
export function whatsappLink(e164Phone: string, message?: string): string {
  const digits = e164Phone.replace(/^\+/, "").replace(/[^\d]/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
