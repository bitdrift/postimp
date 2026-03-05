import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STALE_AFTER_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
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
    const response = await fetch(
      `https://graph.instagram.com/v21.0/${post.instagram_post_id}?fields=like_count,comments_count,timestamp&access_token=${ig.access_token}`,
    );
    const data = await response.json();

    if (data.error) {
      // Return stale cache if available, otherwise error
      if (cached) {
        return NextResponse.json({ stats: cached.data, fetched_at: cached.fetched_at });
      }
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 502 });
    }

    const statsData = {
      likes: data.like_count ?? 0,
      comments: data.comments_count ?? 0,
      posted_at: data.timestamp || null,
    };

    // Upsert cached stats
    await admin.from("post_stats").upsert(
      {
        post_id: postId,
        data: statsData,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "post_id" },
    );

    return NextResponse.json({ stats: statsData, fetched_at: new Date().toISOString() });
  } catch {
    if (cached) {
      return NextResponse.json({ stats: cached.data, fetched_at: cached.fetched_at });
    }
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 502 });
  }
}
