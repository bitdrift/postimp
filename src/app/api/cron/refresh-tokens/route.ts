import { NextRequest, NextResponse } from "next/server";
import { createDbClient } from "@/lib/db/client";
import { refreshInstagramToken } from "@/lib/instagram/auth";
import { updateInstagramToken } from "@/lib/db/instagram";
import { log, timed, serializeError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const elapsed = timed();
  log.info({ operation: "api.cron.refreshTokens", message: "GET /api/cron/refresh-tokens" });

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    log.error({
      operation: "api.cron.refreshTokens",
      message: "CRON_SECRET is not configured",
    });
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createDbClient();
  const now = new Date().toISOString();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: connections, error } = await db
    .from("instagram_connections")
    .select("organization_id, access_token, token_expires_at")
    .not("token_expires_at", "is", null)
    .gt("token_expires_at", now)
    .lt("token_expires_at", sevenDaysFromNow);

  if (error) {
    log.error({
      operation: "api.cron.refreshTokens",
      message: "Failed to query connections",
      error: serializeError(error),
    });
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!connections || connections.length === 0) {
    log.info({
      operation: "api.cron.refreshTokens",
      message: "No tokens to refresh",
      durationMs: elapsed(),
    });
    return NextResponse.json({ refreshed: 0, failed: 0 });
  }

  let refreshed = 0;
  let failed = 0;

  for (const conn of connections) {
    try {
      const result = await refreshInstagramToken(conn.access_token);
      await updateInstagramToken(
        db,
        conn.organization_id,
        result.accessToken,
        result.expiresAt.toISOString(),
      );
      refreshed++;
    } catch (err) {
      failed++;
      log.error({
        operation: "api.cron.refreshTokens",
        message: "Failed to refresh token",
        orgId: conn.organization_id,
        error: serializeError(err),
      });
    }
  }

  log.info({
    operation: "api.cron.refreshTokens",
    message: "Token refresh completed",
    refreshed,
    failed,
    durationMs: elapsed(),
  });
  return NextResponse.json({ refreshed, failed });
}
