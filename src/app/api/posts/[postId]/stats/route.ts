import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { log, timed, serializeError } from "@/lib/logger";

const STALE_AFTER_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const elapsed = timed();
  const { postId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify post belongs to user and is published
  const { data: post } = await admin
    .from("posts")
    .select("id, profile_id, instagram_post_id, status")
    .eq("id", postId)
    .single();

  if (!post || post.profile_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (post.status !== "published" || !post.instagram_post_id) {
    return NextResponse.json({ stats: null, reason: "not_published" });
  }

  // Check for cached stats
  const { data: cached } = await admin
    .from("post_stats")
    .select("*")
    .eq("post_id", postId)
    .single();

  const now = Date.now();
  const isStale = !cached || now - new Date(cached.fetched_at).getTime() > STALE_AFTER_MS;

  if (cached && !isStale) {
    return NextResponse.json({ stats: cached.data, fetched_at: cached.fetched_at });
  }

  // Fetch fresh stats from Instagram
  const { data: ig } = await admin
    .from("instagram_connections")
    .select("access_token")
    .eq("profile_id", user.id)
    .single();

  if (!ig) {
    return NextResponse.json({ stats: cached?.data || null, fetched_at: cached?.fetched_at });
  }

  try {
    // Fetch basic fields (likes, comments)
    const basicResponse = await fetch(
      `https://graph.instagram.com/v21.0/${post.instagram_post_id}?fields=like_count,comments_count,timestamp&access_token=${ig.access_token}`,
    );
    const basicData = await basicResponse.json();

    if (basicData.error) {
      if (cached) {
        return NextResponse.json({ stats: cached.data, fetched_at: cached.fetched_at });
      }
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 502 });
    }

    const statsData: Record<string, unknown> = {
      likes: basicData.like_count ?? 0,
      comments: basicData.comments_count ?? 0,
      posted_at: basicData.timestamp || null,
    };

    // Fetch insights (reach, impressions, saved, shares, profile visits, follows)
    const insightsResponse = await fetch(
      `https://graph.instagram.com/v21.0/${post.instagram_post_id}/insights?metric=impressions,reach,saved,shares,profile_visits,follows&access_token=${ig.access_token}`,
    );
    const insightsData = await insightsResponse.json();

    if (insightsData.data && Array.isArray(insightsData.data)) {
      for (const metric of insightsData.data) {
        statsData[metric.name] = metric.values?.[0]?.value ?? 0;
      }
    }
    // If insights fail (missing scope/permission), we still have basic stats

    // Upsert cached stats
    await admin.from("post_stats").upsert(
      {
        post_id: postId,
        data: statsData,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "post_id" },
    );

    log.info({
      operation: "api.posts.stats",
      message: "Stats fetched from Instagram",
      postId,
      durationMs: elapsed(),
    });

    return NextResponse.json({ stats: statsData, fetched_at: new Date().toISOString() });
  } catch (error) {
    log.error({
      operation: "api.posts.stats",
      message: "Failed to fetch stats",
      postId,
      durationMs: elapsed(),
      error: serializeError(error),
    });
    if (cached) {
      return NextResponse.json({ stats: cached.data, fetched_at: cached.fetched_at });
    }
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 502 });
  }
}
