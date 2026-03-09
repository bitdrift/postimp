import { type NextRequest } from "next/server";

const ALLOWED_HOSTS = new Set((process.env.ALLOWED_HOSTS || "").split(",").filter(Boolean));

/**
 * Derive the base URL from the incoming request, validated against an allowlist.
 * Falls back to NEXT_PUBLIC_APP_URL if the host is not recognized.
 */
export function getBaseUrl(request: NextRequest): string {
  const { protocol, host } = request.nextUrl;
  if (ALLOWED_HOSTS.size === 0 || ALLOWED_HOSTS.has(host)) {
    return `${protocol}//${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL!;
}
