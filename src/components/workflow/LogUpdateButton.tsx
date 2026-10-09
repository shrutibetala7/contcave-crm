"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogUpdateSheet, UndoToast, type LogTarget, type Saved } from "@/components/workflow/LogUpdateSheet";
import type { WorkflowSettings } from "@/lib/validation/settings";

/** Back from WhatsApp within this long? Then the chat probably just happened — ask what. */
const WHATSAPP_RETURN_WINDOW_MS = 10 * 60_000;
const storageKey = (id: string) => `wa-opened:${id}`;

/**
 * The one primary action on an enquiry. Also watches for a WhatsApp link
 * being opened from this page: come back to the tab within 10 minutes and
 * the sheet opens by itself, so the update gets logged straight after the chat.
 */
export function LogUpdateButton({ target, settings }: { target: LogTarget; settings: WorkflowSettings }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const reviving = target.status === "parked";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (link && /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(link.href)) {
        try {
          sessionStorage.setItem(storageKey(target.id), String(Date.now()));
        } catch {
          // storage blocked — the auto-open is a convenience, nothing breaks without it
        }
      }
    }
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      try {
        const at = Number(sessionStorage.getItem(storageKey(target.id)));
        sessionStorage.removeItem(storageKey(target.id));
        if (at && Date.now() - at < WHATSAPP_RETURN_WINDOW_MS) setOpen(true);
      } catch {
        // as above
      }
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [target.id]);

  const clearToast = useCallback(() => setSaved(null), []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        {reviving ? "Revive" : "Log update"}
      </button>
      {open && (
        <LogUpdateSheet
          target={target}
          settings={settings}
          onClose={() => setOpen(false)}
          onSaved={(s) => {
            setOpen(false);
            setSaved(s);
            router.refresh();
          }}
        />
      )}
      {saved && <UndoToast saved={saved} onDone={clearToast} />}
    </>
  );
}
