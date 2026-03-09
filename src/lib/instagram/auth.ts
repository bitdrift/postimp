import { log, timed } from "@/lib/logger";

const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID!;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;

import { REQUIRED_INSTAGRAM_SCOPES } from "@/lib/core/scopes";

export { REQUIRED_INSTAGRAM_SCOPES };

export function getAuthorizationUrl(state: string, baseUrl: string): string {
  const redirectUri = `${baseUrl}/api/instagram/callback`;
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: redirectUri,
    scope: REQUIRED_INSTAGRAM_SCOPES.join(","),
    response_type: "code",
    state,
  });

  return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  baseUrl: string,
): Promise<{ accessToken: string; userId: string }> {
  const elapsed = timed();
  const redirectUri = `${baseUrl}/api/instagram/callback`;
  // Exchange code for short-lived token
  const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error_type || tokenData.error) {
    throw new Error(
      tokenData.error_message || tokenData.error?.message || "Failed to exchange code for token",
    );
  }

  const shortLivedToken = tokenData.access_token;

  // Exchange for long-lived token (60 days)
  const longLivedResponse = await fetch(
    `https://graph.instagram.com/access_token?` +
      new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: INSTAGRAM_APP_SECRET,
        access_token: shortLivedToken,
      }),
  );

  const longLivedData = await longLivedResponse.json();

  if (longLivedData.error) {
    throw new Error(longLivedData.error.message || "Failed to get long-lived token");
  }

  // Fetch the correct user_id from /me to avoid JS number precision issues
  const meResponse = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=user_id&access_token=${longLivedData.access_token}`,
  );
  const meData = await meResponse.json();

  if (meData.error) {
    throw new Error(meData.error.message || "Failed to fetch Instagram user info");
  }

  log.info({
    operation: "instagram.exchangeToken",
    message: "Instagram token exchanged",
    durationMs: elapsed(),
  });

  return {
    accessToken: longLivedData.access_token,
    userId: meData.user_id,
  };
}

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function isTokenExpiringSoon(
  tokenExpiresAt: string | null,
  windowMs: number = REFRESH_WINDOW_MS,
): boolean {
  if (!tokenExpiresAt) return false;
  return new Date(tokenExpiresAt).getTime() - Date.now() < windowMs;
}

export async function refreshInstagramToken(
  currentToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const elapsed = timed();
  const response = await fetch(
    `https://graph.instagram.com/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "ig_refresh_token",
        access_token: currentToken,
      }),
  );

  if (!response.ok) {
    throw new Error(`Instagram token refresh failed with status ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "Failed to refresh Instagram token");
  }

  log.info({
    operation: "instagram.refreshToken",
    message: "Instagram token refreshed",
    durationMs: elapsed(),
  });

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function getGrantedScopes(accessToken: string): Promise<string[] | null> {
  try {
    const response = await fetch(
      `https://graph.instagram.com/v21.0/me/permissions?access_token=${accessToken}`,
    );
    const data = await response.json();

    if (data.error) {
      console.error("[getGrantedScopes] Instagram permissions error:", data.error.message);
      return null;
    }

    return (data.data || [])
      .filter((p: { status: string }) => p.status === "granted")
      .map((p: { permission: string }) => p.permission);
  } catch (err) {
    console.error("[getGrantedScopes] Instagram permissions fetch failed:", err);
    return null;
  }
}

export async function getInstagramUsername(
  userId: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://graph.instagram.com/v21.0/${userId}?fields=username&access_token=${accessToken}`,
    );
    const data = await response.json();
    return data.username || null;
  } catch {
    return null;
  }
}
