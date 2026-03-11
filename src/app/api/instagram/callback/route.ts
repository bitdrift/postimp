import { NextRequest, NextResponse } from "next/server";
import { createDbClient } from "@/lib/db/client";
import { exchangeCodeForToken, getInstagramUsername, getGrantedScopes } from "@/lib/instagram/auth";
import { upsertInstagramConnection } from "@/lib/db/instagram";
import { getActiveOrganization } from "@/lib/db/organizations";
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
    const { accessToken, userId: igUserId } = await exchangeCodeForToken(code, baseUrl);

    const [username, grantedScopes] = await Promise.all([
      getInstagramUsername(igUserId, accessToken),
      getGrantedScopes(accessToken),
    ]);

    const db = createDbClient();

    // Look up the user's organization
    const org = await getActiveOrganization(db, userId);
    if (!org) {
      return NextResponse.redirect(`${baseUrl}/account?error=no_organization`);
    }

    // Upsert the connection
    await upsertInstagramConnection(db, {
      organization_id: org.id,
      connected_by_user_id: userId,
      instagram_user_id: igUserId,
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
      instagram_username: username,
      granted_scopes: grantedScopes,
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
