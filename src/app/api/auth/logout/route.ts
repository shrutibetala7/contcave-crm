import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/jwt";
import { handleRoute } from "@/lib/api/respond";

export async function POST() {
  return handleRoute(async () => {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  });
}
