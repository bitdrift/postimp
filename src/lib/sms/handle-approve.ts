import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/twilio/client";
import { publishToInstagram } from "@/lib/instagram/publish";
import type { Post } from "@/lib/supabase/types";

export async function handleApprove(
  profileId: string,
  phone: string,
  post: Post
) {
  const supabase = createAdminClient();

  // Get Instagram connection
  const { data: connection } = await supabase
    .from("instagram_connections")
    .select("*")
    .eq("profile_id", profileId)
    .single();

  if (!connection) {
    const reply =
      "You need to connect your Instagram account first! Visit: " +
      `${process.env.NEXT_PUBLIC_APP_URL}/account`;
    await sendSmsAndLog(supabase, profileId, phone, reply);
    return;
  }

  // Check token expiry
  if (
    connection.token_expires_at &&
    new Date(connection.token_expires_at) < new Date()
  ) {
    const reply =
      "Your Instagram connection has expired. Please reconnect: " +
      `${process.env.NEXT_PUBLIC_APP_URL}/account`;
    await sendSmsAndLog(supabase, profileId, phone, reply);
    return;
  }

  await sendSmsAndLog(
    supabase,
    profileId,
    phone,
    "Publishing to Instagram... this may take a moment."
  );

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

    await sendSmsAndLog(
      supabase,
      profileId,
      phone,
      "Your post is live on Instagram! 🎉"
    );
  } else {
    await sendSmsAndLog(
      supabase,
      profileId,
      phone,
      `Publishing failed: ${result.error}\n\nYou can try again by replying APPROVE, or CANCEL to discard.`
    );
  }
}

async function sendSmsAndLog(
  supabase: ReturnType<typeof createAdminClient>,
  profileId: string,
  phone: string,
  body: string
) {
  await sendSms(phone, body);
  await supabase.from("messages").insert({
    profile_id: profileId,
    phone,
    direction: "outbound",
    body,
  });
}
