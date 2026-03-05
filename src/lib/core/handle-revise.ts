import { createAdminClient } from "@/lib/supabase/admin";
import { generateCaption } from "@/lib/openai/generate-caption";
import { msgStr, msgFn2 } from "./messages";
import type { Post, MessageChannel } from "@/lib/supabase/types";
import type { DeliverFn } from "./types";

export async function handleRevise(
  profileId: string,
  post: Post,
  feedback: string,
  channel: MessageChannel,
  deliver: DeliverFn,
) {
  const supabase = createAdminClient();

  try {
    // Get profile for AI context
    const { data: profile } = await supabase
      .from("profiles")
      .select("brand_name, brand_description, tone, target_audience")
      .eq("id", profileId)
      .single();

    if (!profile) {
      await deliver(msgStr("profileError", channel), post.id);
      return;
    }

    await deliver(msgStr("revisionAck", channel), post.id);

    // Generate revised caption
    const newCaption = await generateCaption({
      imageUrl: post.image_url,
      userDescription: "",
      profile,
      revisionFeedback: feedback,
      previousCaption: post.caption || "",
    });

    // Update post caption
    await supabase.from("posts").update({ caption: newCaption }).eq("id", post.id);

    const previewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/preview/${post.preview_token}`;
    const truncatedCaption =
      newCaption.length > 300 ? newCaption.substring(0, 297) + "..." : newCaption;

    await deliver(msgFn2("revisedCaption", channel)(truncatedCaption, previewUrl), post.id);
  } catch (error) {
    console.error("Error revising post:", error);
    await deliver(msgStr("reviseError", channel), post.id);
  }
}
