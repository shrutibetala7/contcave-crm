import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/lib/enums";

/**
 * Edge-safe session primitives only (no bcryptjs) — this module is imported
 * by middleware.ts, which runs on the Edge runtime. Password hashing lives
 * in lib/auth.ts, which route handlers (Node runtime) import instead.
 */

export const SESSION_COOKIE = "contcave_session";

const encoder = new TextEncoder();

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Copy .env.example to .env.local.");
  }
  return encoder.encode(secret);
}

export interface SessionPayload {
  sub: string; // userId
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
}

const SESSION_TTL = "7d";

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
