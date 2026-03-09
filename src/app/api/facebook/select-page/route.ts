import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import {
  getPendingFacebookToken,
  deletePendingFacebookToken,
  upsertFacebookConnection,
} from "@/lib/db/facebook";
import { log, timed, serializeError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const elapsed = timed();
  log.info({ operation: "api.facebook.selectPage", message: "POST /api/facebook/select-page" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { page_id, page_name, page_access_token } = await request.json();

  if (!page_id || !page_access_token) {
    return NextResponse.json({ error: "Missing page_id or page_access_token" }, { status: 400 });
  }

  const db = createDbClient();
  const pending = await getPendingFacebookToken(db, user.id);

  if (!pending) {
    return NextResponse.json({ error: "No pending Facebook token found" }, { status: 404 });
  }

  try {
    // Save the Facebook page connection
    await upsertFacebookConnection(db, {
      profile_id: user.id,
      facebook_user_id: pending.facebook_user_id,
      facebook_page_id: page_id,
      page_name: page_name || null,
      page_access_token,
      granted_scopes: pending.granted_scopes,
    });

    // Add "facebook" to publish_platforms if not already present
    const { data: profile } = await db
      .from("profiles")
      .select("publish_platforms")
      .eq("id", user.id)
      .single();

    const platforms: string[] = profile?.publish_platforms || ["instagram"];
    if (!platforms.includes("facebook")) {
      await db
        .from("profiles")
        .update({ publish_platforms: [...platforms, "facebook"] })
        .eq("id", user.id);
    }

    // Clean up pending token
    await deletePendingFacebookToken(db, user.id);

    log.info({
      operation: "api.facebook.selectPage",
      message: "Facebook page connected",
      durationMs: elapsed(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({
      operation: "api.facebook.selectPage",
      message: "POST /api/facebook/select-page failed",
      durationMs: elapsed(),
      error: serializeError(err),
    });
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
