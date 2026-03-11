import { log, timed } from "@/lib/logger";

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID!;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

import { REQUIRED_FACEBOOK_SCOPES } from "@/lib/core/scopes";

export { REQUIRED_FACEBOOK_SCOPES };

export function getFacebookAuthorizationUrl(state: string, baseUrl: string): string {
  const redirectUri = `${baseUrl}/api/facebook/callback`;
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: redirectUri,
    scope: REQUIRED_FACEBOOK_SCOPES.join(","),
    response_type: "code",
    state,
  });

  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  baseUrl: string,
): Promise<{ accessToken: string; userId: string }> {
  const elapsed = timed();
  const redirectUri = `${baseUrl}/api/facebook/callback`;
  // Exchange code for short-lived token
  const tokenResponse = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
  );

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    throw new Error(tokenData.error.message || "Failed to exchange code for token");
  }

  const shortLivedToken = tokenData.access_token;

  // Exchange for long-lived token
  const longLivedResponse = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      }),
  );

  const longLivedData = await longLivedResponse.json();

  if (longLivedData.error) {
    throw new Error(longLivedData.error.message || "Failed to get long-lived token");
  }

  // Fetch user ID
  const meResponse = await fetch(
    `https://graph.facebook.com/v21.0/me?access_token=${longLivedData.access_token}`,
  );
  const meData = await meResponse.json();

  if (meData.error) {
    throw new Error(meData.error.message || "Failed to fetch Facebook user info");
  }

  log.info({
    operation: "facebook.exchangeToken",
    message: "Facebook token exchanged",
    durationMs: elapsed(),
  });

  return {
    accessToken: longLivedData.access_token,
    userId: meData.id,
  };
}

export async function getGrantedScopes(accessToken: string): Promise<string[] | null> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/me/permissions?access_token=${accessToken}`,
    );
    const data = await response.json();

    if (data.error) {
      console.error("[getGrantedScopes] Facebook permissions error:", data.error.message);
      return null;
    }

    return (data.data || [])
      .filter((p: { status: string }) => p.status === "granted")
      .map((p: { permission: string }) => p.permission);
  } catch (err) {
    console.error("[getGrantedScopes] Facebook permissions fetch failed:", err);
    return null;
  }
}

export async function listPages(userAccessToken: string): Promise<FacebookPage[]> {
  // Try /me/accounts first (works with regular Facebook Login)
  const url = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "Failed to list Facebook pages");
  }

  if (data.data?.length > 0) {
    log.info({
      operation: "facebook.listPages",
      message: "Pages found via /me/accounts",
      pageCount: data.data.length,
    });
    return data.data as FacebookPage[];
  }

  // Facebook Login for Business: /me/accounts may return empty.
  // Fall back to extracting page IDs from the token's granular_scopes.
  log.info({
    operation: "facebook.listPages",
    message: "/me/accounts empty, trying granular_scopes fallback",
  });

  const debugRes = await fetch(
    `https://graph.facebook.com/v21.0/debug_token?input_token=${userAccessToken}&access_token=${userAccessToken}`,
  );
  const debugData = await debugRes.json();

  const granularScopes: { scope: string; target_ids?: string[] }[] =
    debugData.data?.granular_scopes || [];
  const pageIds = granularScopes.find((s) => s.scope === "pages_show_list")?.target_ids || [];

  if (pageIds.length === 0) {
    log.info({
      operation: "facebook.listPages",
      message: "No page IDs in granular_scopes",
    });
    return [];
  }

  // Fetch each page individually to get name and page access token
  const pages = await Promise.all(
    pageIds.map(async (pageId) => {
      const pageRes = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}?fields=id,name,access_token&access_token=${userAccessToken}`,
      );
      const pageData = await pageRes.json();
      if (pageData.error) {
        log.warn({
          operation: "facebook.listPages",
          message: `Failed to fetch page ${pageId}`,
          error: pageData.error,
        });
        return null;
      }
      return pageData as FacebookPage;
    }),
  );

  const validPages = pages.filter((p): p is FacebookPage => p !== null);

  log.info({
    operation: "facebook.listPages",
    message: "Pages found via granular_scopes fallback",
    pageCount: validPages.length,
  });

  return validPages;
}
