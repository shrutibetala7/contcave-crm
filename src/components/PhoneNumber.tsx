"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

/** "+91 98765 43210" — Indian numbers grouped the way people read them out. */
function displayPhone(phone: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

/** The number itself, readable at a glance, with one-tap copy and call. */
export function PhoneNumber({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access can be denied by the browser — the number is still on screen to select
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="select-all tabular-nums text-neutral-800">{displayPhone(phone)}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${phone}`}
        title={copied ? "Copied" : "Copy number"}
        className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      >
        <Icon name={copied ? "check" : "link"} className="size-3.5" />
      </button>
      <a
        href={`tel:${phone}`}
        aria-label={`Call ${phone}`}
        title="Call"
        className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      >
        <Icon name="phone" className="size-3.5" />
      </a>
    </span>
  );
}
