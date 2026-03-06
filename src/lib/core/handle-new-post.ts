import { createDbClient } from "@/lib/db/client";
import { insertPost } from "@/lib/db/posts";
import { uploadPostImage, getPostImageUrl } from "@/lib/db/storage";
import { msgStr } from "./messages";
import type { MessageChannel } from "@/lib/db/messages";
import type { DeliverFn } from "./types";

export type ImageSource =
  | { kind: "url"; mediaUrl: string }
  | { kind: "buffer"; imageBuffer: ArrayBuffer; contentType: string };

export interface UploadResult {
  postId: string;
  imageUrl: string;
  previewToken: string;
}

export async function uploadAndCreatePost(
  profileId: string,
  source: ImageSource,
  channel: MessageChannel,
  deliver: DeliverFn,
): Promise<UploadResult | null> {
  const db = createDbClient();

  try {
    let imageBuffer: ArrayBuffer;
    let contentType: string;

    if (source.kind === "url") {
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

    try {
      await uploadPostImage(db, fileName, imageBuffer, contentType);
    } catch {
      await deliver(msgStr("imageUploadError", channel));
      return null;
    }

    const publicUrl = getPostImageUrl(db, fileName);

    const post = await insertPost(db, {
      profile_id: profileId,
      image_url: publicUrl,
      caption: "",
      status: "draft",
    });

    return { postId: post.id, imageUrl: publicUrl, previewToken: post.preview_token };
  } catch (error) {
    console.error("Error creating post:", error);
    await deliver(msgStr("genericError", channel));
    return null;
  }
}
