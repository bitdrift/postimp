import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForToken,
  getInstagramUsername,
} from "@/lib/instagram/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/account?error=instagram_denied`
    );
  }

  // Extract user ID from state
  const userId = state.split(":")[0];
  if (!userId) {
    return NextResponse.redirect(
      `${baseUrl}/account?error=invalid_state`
    );
  }

  try {
    const { accessToken, userId: igUserId } =
      await exchangeCodeForToken(code);

    const username = await getInstagramUsername(igUserId, accessToken);

    const supabase = createAdminClient();

    // Upsert the connection
    await supabase.from("instagram_connections").upsert(
      {
        profile_id: userId,
        instagram_user_id: igUserId,
        access_token: accessToken,
        token_expires_at: new Date(
          Date.now() + 60 * 24 * 60 * 60 * 1000
        ).toISOString(), // 60 days
        instagram_username: username,
      },
      { onConflict: "profile_id" }
    );

    return NextResponse.redirect(
      `${baseUrl}/account?instagram=connected`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Instagram OAuth error:", message);
    return NextResponse.redirect(
      `${baseUrl}/account?error=instagram_failed&detail=${encodeURIComponent(message)}`
    );
  }
}
