const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID!;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

export function getFacebookAuthorizationUrl(state: string, baseUrl: string): string {
  const redirectUri = `${baseUrl}/api/facebook/callback`;
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: redirectUri,
    scope: "pages_manage_posts,pages_read_engagement",
    response_type: "code",
    state,
  });

  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  baseUrl: string,
): Promise<{ accessToken: string; userId: string }> {
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

  return {
    accessToken: longLivedData.access_token,
    userId: meData.id,
  };
}

export async function listPages(userAccessToken: string): Promise<FacebookPage[]> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}`,
  );
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "Failed to list Facebook pages");
  }

  return (data.data || []) as FacebookPage[];
}
