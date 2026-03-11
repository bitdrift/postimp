import { NextRequest, NextResponse } from "next/server";
import { createDbClient } from "@/lib/db/client";
import { exchangeCodeForToken, getInstagramUsername } from "@/lib/instagram/auth";
import { upsertInstagramConnection } from "@/lib/db/instagram";
import { getBaseUrl } from "@/lib/core/url";
import { log, timed, serializeError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const elapsed = timed();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = getBaseUrl(request);

  log.info({ operation: "api.instagram.callback", message: "GET /api/instagram/callback" });

  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/account?error=instagram_denied`);
  }

  // Extract user ID from state
  const userId = state.split(":")[0];
  if (!userId) {
    return NextResponse.redirect(`${baseUrl}/account?error=invalid_state`);
  }

  try {
    const {
      accessToken,
      userId: igUserId,
      permissions,
    } = await exchangeCodeForToken(code, baseUrl);

    const username = await getInstagramUsername(igUserId, accessToken);

    const db = createDbClient();

    // Upsert the connection
    await upsertInstagramConnection(db, {
      profile_id: userId,
      instagram_user_id: igUserId,
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
      instagram_username: username,
      granted_scopes: permissions.length > 0 ? permissions : null,
    });

    log.info({
      operation: "api.instagram.callback",
      message: "Instagram connected",
      profileId: userId,
      durationMs: elapsed(),
    });

    return NextResponse.redirect(`${baseUrl}/account?instagram=connected`);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object"
          ? JSON.stringify(err)
          : String(err);
    log.error({
      operation: "api.instagram.callback",
      message: "Instagram OAuth error",
      durationMs: elapsed(),
      error: serializeError(err),
    });
    return NextResponse.redirect(
      `${baseUrl}/account?error=instagram_failed&detail=${encodeURIComponent(message)}`,
    );
  }
}
