const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID!;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/instagram/callback`;

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope:
      "instagram_content_publish,pages_show_list,pages_read_engagement",
    response_type: "code",
    state,
  });

  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string
): Promise<{ accessToken: string; userId: string }> {
  // Exchange code for short-lived token
  const tokenResponse = await fetch(
    "https://graph.facebook.com/v21.0/oauth/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code,
      }),
    }
  );

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    throw new Error(
      tokenData.error.message || "Failed to exchange code for token"
    );
  }

  // Exchange for long-lived token (60 days)
  const longLivedResponse = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        fb_exchange_token: tokenData.access_token,
      })
  );

  const longLivedData = await longLivedResponse.json();

  if (longLivedData.error) {
    throw new Error(
      longLivedData.error.message || "Failed to get long-lived token"
    );
  }

  // Get Instagram Business Account ID via pages
  const pagesResponse = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedData.access_token}`
  );
  const pagesData = await pagesResponse.json();

  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error("No Facebook Pages found. Please connect a Facebook Page first.");
  }

  const pageId = pagesData.data[0].id;
  const pageAccessToken = pagesData.data[0].access_token;

  // Get Instagram Business Account
  const igResponse = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
  );
  const igData = await igResponse.json();

  if (!igData.instagram_business_account) {
    throw new Error(
      "No Instagram Business Account linked to your Facebook Page."
    );
  }

  return {
    accessToken: longLivedData.access_token,
    userId: igData.instagram_business_account.id,
  };
}

export async function getInstagramUsername(
  userId: string,
  accessToken: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${userId}?fields=username&access_token=${accessToken}`
    );
    const data = await response.json();
    return data.username || null;
  } catch {
    return null;
  }
}
