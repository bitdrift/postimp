import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { OrgRole } from "@/lib/supabase/types";

const COOKIE_NAME = "active_org";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export interface OrgContext {
  orgId: string;
  orgName: string;
  role: OrgRole;
  userId: string;
}

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for org context");
  cachedSecret = new TextEncoder().encode(key);
  return cachedSecret;
}

export async function createOrgToken(ctx: OrgContext): Promise<string> {
  return new SignJWT({
    orgId: ctx.orgId,
    orgName: ctx.orgName,
    role: ctx.role,
    userId: ctx.userId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyOrgToken(token: string): Promise<OrgContext | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      orgId: payload.orgId as string,
      orgName: payload.orgName as string,
      role: payload.role as OrgRole,
      userId: payload.userId as string,
    };
  } catch {
    return null;
  }
}

export async function getActiveOrgContext(): Promise<OrgContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyOrgToken(token);
}

export function buildOrgCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export { COOKIE_NAME };
