"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { QuickAddModal } from "@/components/QuickAddModal";

export function AppShell({
  userName,
  userId,
  children,
}: {
  userName: string;
  userId: string | null;
  children: React.ReactNode;
}) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        setQuickAddOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-md bg-neutral-900 px-3 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50"
      >
        Skip to content
      </a>
      <Nav userName={userName} onQuickAdd={() => setQuickAddOpen(true)} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} userId={userId} />
    </>
  );
}
