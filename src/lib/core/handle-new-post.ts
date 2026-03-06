import { createDbClient } from "@/lib/db/client";
import { generateCaption } from "@/lib/openai/generate-caption";
import { getProfile } from "@/lib/db/profiles";
import { getRecentCaptions, insertPost } from "@/lib/db/posts";
import { uploadPostImage, getPostImageUrl } from "@/lib/db/storage";
import { msgStr, msgFn2 } from "./messages";
import type { MessageChannel } from "@/lib/db/messages";
import type { DeliverFn } from "./types";

export async function handleNewPost(
  profileId: string,
  description: string,
  channel: MessageChannel,
  deliver: DeliverFn,
  source:
    | { kind: "url"; mediaUrl: string }
    | { kind: "buffer"; imageBuffer: ArrayBuffer; contentType: string },
): Promise<string | null> {
  const db = createDbClient();

  try {
    let imageBuffer: ArrayBuffer;
    let contentType: string;

    if (source.kind === "url") {
      // Download image from Twilio (requires Basic auth)
      const twilioAuth = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
      ).toString("base64");

      const imageResponse = await fetch(source.mediaUrl, {
        headers: { Authorization: `Basic ${twilioAuth}` },
      });

      if (!imageResponse.ok) {
        await deliver(msgStr("imageDownloadError", channel));
        return null;
      }

      imageBuffer = await imageResponse.arrayBuffer();
      contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    } else {
      imageBuffer = source.imageBuffer;
      contentType = source.contentType;
    }

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const fileName = `${profileId}/${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    try {
      await uploadPostImage(db, fileName, imageBuffer, contentType);
    } catch {
      await deliver(msgStr("imageUploadError", channel));
      return null;
    }

    const publicUrl = getPostImageUrl(db, fileName);

    // Get profile for AI context
    const profile = await getProfile(db, profileId);

    if (!profile) {
      await deliver(msgStr("profileError", channel));
      return null;
    }

    // Get recent captions for consistency
    const recentCaptions = await getRecentCaptions(db, profileId);

    // Generate caption with AI
    const caption = await generateCaption({
      imageUrl: publicUrl,
      userDescription: description,
      profile,
      recentCaptions,
    });

    // Create draft post
    const post = await insertPost(db, {
      profile_id: profileId,
      image_url: publicUrl,
      caption,
      status: "draft",
    });

    // Send caption preview
    const previewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/preview/${post.preview_token}`;
    const truncatedCaption = caption.length > 300 ? caption.substring(0, 297) + "..." : caption;

    await deliver(msgFn2("draftCaption", channel)(truncatedCaption, previewUrl), post.id);
    return post.id;
  } catch (error) {
    console.error("Error creating post:", error);
    await deliver(msgStr("genericError", channel));
    return null;
  }
}
