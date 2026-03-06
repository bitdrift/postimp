import { createDbClient } from "@/lib/db/client";
import { generateCaption } from "@/lib/openai/generate-caption";
import { getProfile } from "@/lib/db/profiles";
import { updatePost, type Post } from "@/lib/db/posts";
import { msgStr, msgFn2 } from "./messages";
import type { MessageChannel } from "@/lib/db/messages";
import type { DeliverFn } from "./types";

export async function handleRevise(
  profileId: string,
  post: Post,
  feedback: string,
  channel: MessageChannel,
  deliver: DeliverFn,
) {
  const db = createDbClient();

  try {
    // Get profile for AI context
    const profile = await getProfile(db, profileId);

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
    await updatePost(db, post.id, { caption: newCaption });

    const previewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/preview/${post.preview_token}`;
    const truncatedCaption =
      newCaption.length > 300 ? newCaption.substring(0, 297) + "..." : newCaption;

    await deliver(msgFn2("revisedCaption", channel)(truncatedCaption, previewUrl), post.id);
  } catch (error) {
    console.error("Error revising post:", error);
    await deliver(msgStr("reviseError", channel), post.id);
  }
}
