import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getInstagramConnection } from "@/lib/db/instagram";
import { getFacebookConnection, getPendingFacebookToken } from "@/lib/db/facebook";
import { getActiveOrganization } from "@/lib/db/organizations";
import { log, timed, serializeError } from "@/lib/logger";

async function getIgUserIdFromToken(accessToken: string): Promise<string | null> {
  try {
    // Get the user's Facebook pages, then find one with a linked Instagram account
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,instagram_business_account&access_token=${accessToken}`,
    );
    const pagesData = await pagesRes.json();
    for (const page of pagesData.data || []) {
      if (page.instagram_business_account?.id) {
        return page.instagram_business_account.id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const elapsed = timed();
  const username = req.nextUrl.searchParams.get("username")?.trim().replace(/^@/, "");

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createDbClient();
  const org = await getActiveOrganization(db, user.id);

  if (!org) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const [igConnection, fbConnection, pendingFb] = await Promise.all([
    getInstagramConnection(db, org.id),
    getFacebookConnection(db, org.id),
    getPendingFacebookToken(db, org.id),
  ]);

  // Business Discovery requires a Facebook Login token on graph.facebook.com
  const accessToken = fbConnection?.page_access_token || pendingFb?.user_access_token;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Facebook connection is required for account lookup" },
      { status: 400 },
    );
  }

  // Get IG user ID from Instagram connection, or discover it via Facebook token
  const igUserId = igConnection?.instagram_user_id || (await getIgUserIdFromToken(accessToken));

  if (!igUserId) {
    return NextResponse.json(
      {
        error:
          "No Instagram business account found. Make sure your Instagram account is linked to a Facebook page.",
      },
      { status: 400 },
    );
  }

  const tokenSource = fbConnection ? "page_token" : "pending_user_token";
  log.info({
    operation: "api.insights.lookup",
    message: "Lookup params",
    igUserId,
    tokenSource,
    username,
  });

  try {
    // Use Business Discovery API via Facebook Graph API
    const fields = [
      "username",
      "name",
      "biography",
      "profile_picture_url",
      "followers_count",
      "follows_count",
      "media_count",
      "media{caption,like_count,comments_count,media_url,media_type,permalink,timestamp}",
    ].join(",");

    const url =
      `https://graph.facebook.com/v21.0/${igUserId}` +
      `?fields=business_discovery.fields(${fields}).username(${username})` +
      `&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      log.error({
        operation: "api.insights.lookup",
        message: "Business Discovery API error",
        username,
        durationMs: elapsed(),
        error: data.error,
      });

      if (data.error.code === 110) {
        return NextResponse.json({ error: "Account not found or is private" }, { status: 404 });
      }
      return NextResponse.json(
        { error: data.error.message || "Failed to look up account" },
        { status: 502 },
      );
    }

    const discovery = data.business_discovery;
    if (!discovery) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const result = {
      username: discovery.username,
      name: discovery.name || null,
      biography: discovery.biography || null,
      profile_picture_url: discovery.profile_picture_url || null,
      followers_count: discovery.followers_count ?? null,
      follows_count: discovery.follows_count ?? null,
      media_count: discovery.media_count ?? null,
      media: (discovery.media?.data || [])
        .slice(0, 5)
        .map(
          (m: {
            caption?: string;
            like_count?: number;
            comments_count?: number;
            media_url?: string;
            media_type?: string;
            permalink?: string;
            timestamp?: string;
          }) => ({
            caption: m.caption || null,
            like_count: m.like_count ?? 0,
            comments_count: m.comments_count ?? 0,
            media_url: m.media_url || null,
            media_type: m.media_type || null,
            permalink: m.permalink || null,
            timestamp: m.timestamp || null,
          }),
        ),
    };

    log.info({
      operation: "api.insights.lookup",
      message: "Account lookup successful",
      username,
      mediaCount: result.media.length,
      durationMs: elapsed(),
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error({
      operation: "api.insights.lookup",
      message: "Account lookup failed",
      username,
      durationMs: elapsed(),
      error: serializeError(error),
    });
    return NextResponse.json({ error: "Failed to look up account" }, { status: 502 });
  }
}
