import { NextRequest, NextResponse } from "next/server";
import { createDbClient } from "@/lib/db/client";
import { exchangeCodeForToken } from "@/lib/facebook/auth";
import { savePendingFacebookToken } from "@/lib/db/facebook";
import { getBaseUrl } from "@/lib/core/url";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = getBaseUrl(request);

  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/account?error=facebook_denied`);
  }

  const userId = state.split(":")[0];
  if (!userId) {
    return NextResponse.redirect(`${baseUrl}/account?error=invalid_state`);
  }

  try {
    const { accessToken, userId: fbUserId } = await exchangeCodeForToken(code, baseUrl);

    const db = createDbClient();

    // Save token to pending table (not in URL) for page selection step
    await savePendingFacebookToken(db, userId, fbUserId, accessToken);

    return NextResponse.redirect(`${baseUrl}/account/facebook-pages`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Facebook OAuth error:", message);
    return NextResponse.redirect(
      `${baseUrl}/account?error=facebook_failed&detail=${encodeURIComponent(message)}`,
    );
  }
}
