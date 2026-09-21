"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { api } from "@/lib/apiClient";

const LINKS = [
  { href: "/today", label: "Today" },
  { href: "/enquiries", label: "Enquiries" },
  { href: "/studios", label: "Studios" },
];

export function Nav({
  userName,
  onQuickAdd,
}: {
  userName: string;
  onQuickAdd: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
        <span className="text-sm font-semibold tracking-tight text-neutral-900">
          ContCave <span className="font-medium text-neutral-500">CRM</span>
        </span>
        {/* On phones the tabs drop to their own full-width row instead of crushing the actions. */}
        <nav aria-label="Main" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors sm:py-1.5 ${
                  active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={onQuickAdd} className="btn-primary" aria-keyshortcuts="c">
            <Icon name="plus" className="size-3.5" />
            Quick add
            <span className="kbd hidden border-neutral-600 bg-neutral-800 text-neutral-300 md:inline-flex" aria-hidden>
              C
            </span>
          </button>
          <span className="hidden text-sm text-neutral-600 sm:inline">{userName}</span>
          <button onClick={logout} className="link-quiet py-2 text-sm">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
