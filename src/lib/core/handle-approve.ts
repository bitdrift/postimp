import { createDbClient } from "@/lib/db/client";
import { publishToInstagram } from "@/lib/instagram/publish";
import { getInstagramConnection, updateInstagramToken } from "@/lib/db/instagram";
import { updatePost, type Post } from "@/lib/db/posts";
import { refreshInstagramToken, isTokenExpiringSoon } from "@/lib/instagram/auth";

export interface PublishResult {
  success: boolean;
  error?: string;
  instagramPostId?: string;
}

export async function executePublish(profileId: string, post: Post): Promise<PublishResult> {
  const db = createDbClient();

  const connection = await getInstagramConnection(db, profileId);

  if (!connection) {
    return { success: false, error: "No Instagram account connected. Please connect one first." };
  }

  if (isTokenExpiringSoon(connection.token_expires_at, 0)) {
    return { success: false, error: "Your Instagram connection has expired. Please reconnect." };
  }

  const result = await publishToInstagram(
    connection.instagram_user_id,
    connection.access_token,
    post.image_url,
    post.caption || "",
  );

  if (result.success) {
    await updatePost(db, post.id, {
      status: "published",
      instagram_post_id: result.instagramPostId,
      published_at: new Date().toISOString(),
    });

    // Opportunistic token refresh
    if (isTokenExpiringSoon(connection.token_expires_at)) {
      try {
        const refreshed = await refreshInstagramToken(connection.access_token);
        await updateInstagramToken(
          db,
          profileId,
          refreshed.accessToken,
          refreshed.expiresAt.toISOString(),
        );
      } catch (err) {
        console.error("Opportunistic token refresh failed:", err);
      }
    }

    return { success: true, instagramPostId: result.instagramPostId };
  }

  return { success: false, error: result.error || "Unknown publishing error" };
}
