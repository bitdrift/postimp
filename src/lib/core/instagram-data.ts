import { createDbClient } from "@/lib/db/client";
import type { Post } from "@/lib/supabase/types";

async function getAccessToken(profileId: string): Promise<string | null> {
  const db = createDbClient();
  const { data } = await db
    .from("instagram_connections")
    .select("access_token")
    .eq("profile_id", profileId)
    .single();
  return data?.access_token ?? null;
}

export async function fetchPostStats(
  profileId: string,
  post: Post,
): Promise<{ stats: Record<string, unknown> } | { error: string }> {
  if (!post.instagram_post_id) {
    return { error: "No Instagram post ID found." };
  }

  const accessToken = await getAccessToken(profileId);
  if (!accessToken) {
    return { error: "No Instagram connection found. Connect Instagram in account settings." };
  }

  try {
    const basicRes = await fetch(
      `https://graph.instagram.com/v21.0/${post.instagram_post_id}?fields=like_count,comments_count,timestamp&access_token=${accessToken}`,
    );
    const basicData = await basicRes.json();

    if (basicData.error) {
      return { error: `Instagram API error: ${basicData.error.message}` };
    }

    const stats: Record<string, unknown> = {
      likes: basicData.like_count ?? 0,
      comments: basicData.comments_count ?? 0,
      posted_at: basicData.timestamp || null,
    };

    // Try to fetch insights (may fail depending on permissions)
    const insightsRes = await fetch(
      `https://graph.instagram.com/v21.0/${post.instagram_post_id}/insights?metric=impressions,reach,saved,shares,profile_visits,follows&access_token=${accessToken}`,
    );
    const insightsData = await insightsRes.json();

    if (insightsData.data && Array.isArray(insightsData.data)) {
      for (const metric of insightsData.data) {
        stats[metric.name] = metric.values?.[0]?.value ?? 0;
      }
    }

    return { stats };
  } catch {
    return { error: "Failed to fetch stats from Instagram." };
  }
}

export async function fetchPostComments(
  profileId: string,
  post: Post,
): Promise<
  { comments: Array<{ username: string; text: string; timestamp: string }> } | { error: string }
> {
  if (!post.instagram_post_id) {
    return { error: "No Instagram post ID found." };
  }

  const accessToken = await getAccessToken(profileId);
  if (!accessToken) {
    return { error: "No Instagram connection found. Connect Instagram in account settings." };
  }

  try {
    const res = await fetch(
      `https://graph.instagram.com/v21.0/${post.instagram_post_id}/comments?fields=username,text,timestamp&limit=50&access_token=${accessToken}`,
    );
    const data = await res.json();

    if (data.error) {
      return { error: `Instagram API error: ${data.error.message}` };
    }

    const comments = (data.data || []).map(
      (c: { username: string; text: string; timestamp: string }) => ({
        username: c.username,
        text: c.text,
        timestamp: c.timestamp,
      }),
    );

    return { comments };
  } catch {
    return { error: "Failed to fetch comments from Instagram." };
  }
}
