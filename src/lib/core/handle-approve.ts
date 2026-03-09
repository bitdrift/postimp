import { createDbClient } from "@/lib/db/client";
import { publishToInstagram } from "@/lib/instagram/publish";
import { publishToFacebook } from "@/lib/facebook/publish";
import { getInstagramConnection, updateInstagramToken } from "@/lib/db/instagram";
import { getFacebookConnection } from "@/lib/db/facebook";
import { getProfile, updateProfile } from "@/lib/db/profiles";
import { updatePost, type Post } from "@/lib/db/posts";
import { refreshInstagramToken, isTokenExpiringSoon } from "@/lib/instagram/auth";
import { log, timed, serializeError } from "@/lib/logger";

export interface PublishResult {
  success: boolean;
  error?: string;
  instagramPostId?: string;
  instagramPermalink?: string;
  facebookPostId?: string;
  partial?: boolean;
}

export async function executePublish(profileId: string, post: Post): Promise<PublishResult> {
  const db = createDbClient();

  // Fetch profile to get publish_platforms preference
  const profile = await getProfile(db, profileId);
  const platforms: string[] = profile?.publish_platforms || ["instagram"];

  log.info({
    operation: "publish",
    message: "Starting publish",
    profileId,
    postId: post.id,
    platforms,
  });

  const elapsed = timed();

  // Fetch connections for the preferred platforms in parallel
  const [igConnection, fbConnection] = await Promise.all([
    platforms.includes("instagram") ? getInstagramConnection(db, profileId) : null,
    platforms.includes("facebook") ? getFacebookConnection(db, profileId) : null,
  ]);

  // Filter to valid connections
  const validIg = igConnection && !isTokenExpiringSoon(igConnection.token_expires_at, 0);
  const validFb = !!fbConnection;

  if (!validIg && !validFb) {
    return {
      success: false,
      error: "No publishing platform connected. Please connect Instagram or Facebook.",
    };
  }

  // Publish to valid platforms in parallel
  const [igResult, fbResult] = await Promise.all([
    validIg
      ? publishToInstagram(
          igConnection!.instagram_user_id,
          igConnection!.access_token,
          post.image_url,
          post.caption || "",
        )
      : null,
    validFb
      ? publishToFacebook(
          fbConnection!.facebook_page_id,
          fbConnection!.page_access_token,
          post.image_url,
          post.caption || "",
        )
      : null,
  ]);

  const igSuccess = igResult?.success ?? false;
  const fbSuccess = fbResult?.success ?? false;
  const anySuccess = igSuccess || fbSuccess;
  const allSuccess = (!validIg || igSuccess) && (!validFb || fbSuccess);

  log.info({
    operation: "publish",
    message: "Publish completed",
    profileId,
    postId: post.id,
    durationMs: elapsed(),
    igSuccess,
    fbSuccess,
    allSuccess,
  });

  if (anySuccess) {
    const updateFields: Record<string, unknown> = {
      status: "published",
      published_at: new Date().toISOString(),
    };
    if (igSuccess) {
      updateFields.instagram_post_id = igResult!.instagramPostId;
      if (igResult!.permalink) updateFields.instagram_permalink = igResult!.permalink;
    }
    if (fbSuccess) updateFields.facebook_post_id = fbResult!.facebookPostId;

    await updatePost(db, post.id, updateFields);

    // Opportunistic Instagram token refresh
    if (validIg && igSuccess && isTokenExpiringSoon(igConnection!.token_expires_at)) {
      try {
        const refreshed = await refreshInstagramToken(igConnection!.access_token);
        await updateInstagramToken(
          db,
          profileId,
          refreshed.accessToken,
          refreshed.expiresAt.toISOString(),
        );
      } catch (err) {
        log.warn({
          operation: "publish.tokenRefresh",
          message: "Opportunistic token refresh failed",
          profileId,
          error: serializeError(err),
        });
      }
    }

    // Update sticky preference to match what was attempted
    const attempted = [...(validIg ? ["instagram"] : []), ...(validFb ? ["facebook"] : [])];
    await updateProfile(db, profileId, { publish_platforms: attempted });

    if (allSuccess) {
      return {
        success: true,
        instagramPostId: igResult?.instagramPostId,
        instagramPermalink: igResult?.permalink,
        facebookPostId: fbResult?.facebookPostId,
      };
    }

    // Partial failure
    const failedError = igResult?.error || fbResult?.error || "Unknown error";
    return {
      success: true,
      partial: true,
      error: failedError,
      instagramPostId: igResult?.instagramPostId,
      instagramPermalink: igResult?.permalink,
      facebookPostId: fbResult?.facebookPostId,
    };
  }

  // All failed
  const errors = [igResult?.error, fbResult?.error].filter(Boolean).join("; ");
  return { success: false, error: errors || "Unknown publishing error" };
}
