import { getSession } from "@/lib/session";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts already redirects unauthenticated requests to /login;
  // this is just for display (nav shows who's signed in).
  const session = await getSession();
  return (
    <AppShell userName={session?.name ?? "—"} userId={session?.sub ?? null}>
      {children}
    </AppShell>
  );
}
