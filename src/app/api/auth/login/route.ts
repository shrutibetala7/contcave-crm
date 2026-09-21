import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { usersCol } from "@/lib/db/collections";
import { verifyPassword, signSession, SESSION_COOKIE } from "@/lib/auth";
import { serialize, omit } from "@/lib/db/serialize";
import { handleRoute, parseJson } from "@/lib/api/respond";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = await parseJson(request);
    const { email, password } = loginSchema.parse(body);

    const users = await usersCol();
    const user = await users.findOne({ email: email.toLowerCase(), active: true });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await signSession({
      sub: user._id.toHexString(),
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({ user: serialize(omit(user, "passwordHash")) });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  });
}
