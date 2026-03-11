import { NextRequest, NextResponse } from "next/server";
import { createDbClient } from "@/lib/db/client";
import { exchangeCodeForToken, getGrantedScopes } from "@/lib/facebook/auth";
import { savePendingFacebookToken } from "@/lib/db/facebook";
import { getBaseUrl } from "@/lib/core/url";
import { log, timed, serializeError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const elapsed = timed();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = getBaseUrl(request);

  log.info({ operation: "api.facebook.callback", message: "GET /api/facebook/callback" });

  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/account?error=facebook_denied`);
  }

  const stateParts = state.split(":");
  const userId = stateParts[0];
  const returnTo = stateParts.slice(2).join(":") || "/account";
  if (!userId) {
    return NextResponse.redirect(`${baseUrl}/account?error=invalid_state`);
  }

  try {
    const { accessToken, userId: fbUserId } = await exchangeCodeForToken(code, baseUrl);
    const grantedScopes = await getGrantedScopes(accessToken);

    const db = createDbClient();

    // Save token to pending table (not in URL) for page selection step
    await savePendingFacebookToken(db, userId, fbUserId, accessToken, grantedScopes ?? undefined);

    log.info({
      operation: "api.facebook.callback",
      message: "Facebook token exchanged",
      profileId: userId,
      durationMs: elapsed(),
    });

    return NextResponse.redirect(
      `${baseUrl}/account/facebook-pages?returnTo=${encodeURIComponent(returnTo)}`,
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object"
          ? JSON.stringify(err)
          : String(err);
    log.error({
      operation: "api.facebook.callback",
      message: "Facebook OAuth error",
      durationMs: elapsed(),
      error: serializeError(err),
    });
    return NextResponse.redirect(
      `${baseUrl}/account?error=facebook_failed&detail=${encodeURIComponent(message)}`,
    );
  }
}
