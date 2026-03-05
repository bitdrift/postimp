const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID!;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/instagram/callback`;

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights",
    response_type: "code",
    state,
  });

  return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
): Promise<{ accessToken: string; userId: string }> {
  // Exchange code for short-lived token
  const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
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

  return {
    accessToken: longLivedData.access_token,
    userId: meData.user_id,
  };
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
