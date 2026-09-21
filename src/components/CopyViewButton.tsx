"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

/** Change Brief v1.1 §C: a filtered view should be shareable — copy the current URL. */
export function CopyViewButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access can be denied by the browser — fail silently, nothing to recover
    }
  }

  return (
    <button onClick={copy} type="button" className="link-quiet inline-flex shrink-0 items-center gap-1 py-1 text-xs">
      <Icon name={copied ? "check" : "link"} className="size-3.5" />
      <span aria-live="polite">{copied ? "Link copied" : "Copy link to this view"}</span>
    </button>
  );
}
