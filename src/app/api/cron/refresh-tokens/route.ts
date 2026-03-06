import { NextRequest, NextResponse } from "next/server";
import { createDbClient } from "@/lib/db/client";
import { refreshInstagramToken } from "@/lib/instagram/auth";
import { updateInstagramToken } from "@/lib/db/instagram";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("Cron: CRON_SECRET is not configured");
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
    .select("profile_id, access_token, token_expires_at")
    .not("token_expires_at", "is", null)
    .gt("token_expires_at", now)
    .lt("token_expires_at", sevenDaysFromNow);

  if (error) {
    console.error("Cron: failed to query connections:", error.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({ refreshed: 0, failed: 0 });
  }

  let refreshed = 0;
  let failed = 0;

  for (const conn of connections) {
    try {
      const result = await refreshInstagramToken(conn.access_token);
      await updateInstagramToken(
        db,
        conn.profile_id,
        result.accessToken,
        result.expiresAt.toISOString(),
      );
      refreshed++;
    } catch (err) {
      failed++;
      console.error(
        `Cron: failed to refresh token for profile ${conn.profile_id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`Cron: refreshed ${refreshed}, failed ${failed}`);
  return NextResponse.json({ refreshed, failed });
}
