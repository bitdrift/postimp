import { createAdminClient } from "@/lib/supabase/admin";
import { publishToInstagram } from "@/lib/instagram/publish";
import { msgStr, msgFn1 } from "./messages";
import type { Post, MessageChannel } from "@/lib/supabase/types";
import type { DeliverFn } from "./types";

export async function handleApprove(
  profileId: string,
  post: Post,
  channel: MessageChannel,
  deliver: DeliverFn
) {
  const supabase = createAdminClient();

  // Get Instagram connection
  const { data: connection } = await supabase
    .from("instagram_connections")
    .select("*")
    .eq("profile_id", profileId)
    .single();

  if (!connection) {
    await deliver(msgStr("noInstagram", channel), post.id);
    return;
  }

  // Check token expiry
  if (
    connection.token_expires_at &&
    new Date(connection.token_expires_at) < new Date()
  ) {
    await deliver(msgStr("instagramExpired", channel), post.id);
    return;
  }

  await deliver(msgStr("publishStarted", channel), post.id);

  const result = await publishToInstagram(
    connection.instagram_user_id,
    connection.access_token,
    post.image_url,
    post.caption || ""
  );

  if (result.success) {
    await supabase
      .from("posts")
      .update({
        status: "published",
        instagram_post_id: result.instagramPostId,
        published_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    await deliver(msgStr("publishSuccess", channel), post.id);
  } else {
    await deliver(msgFn1("publishFailed", channel)(result.error || "Unknown error"), post.id);
  }
}
