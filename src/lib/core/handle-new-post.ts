import OpenAI from "openai";
import { createDbClient } from "@/lib/db/client";
import type { DbClient } from "@/lib/db/client";
import { insertPost } from "@/lib/db/posts";
import { uploadPostImage, getPostImageUrl } from "@/lib/db/storage";
import { getOrganizationsForUser } from "@/lib/db/organizations";
import type { Organization } from "@/lib/db/organizations";
import { msgStr } from "./messages";
import type { MessageChannel } from "@/lib/db/messages";
import type { DeliverFn } from "./types";
import { log, timed, serializeError } from "@/lib/logger";

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
  messageBody?: string,
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

    const elapsed = timed();
    try {
      await uploadPostImage(db, fileName, imageBuffer, contentType);
    } catch {
      await deliver(msgStr("imageUploadError", channel));
      return null;
    }

    const publicUrl = getPostImageUrl(db, fileName);

    const org = await resolveOrganization(db, profileId, messageBody);
    const post = await insertPost(db, {
      profile_id: profileId,
      organization_id: org?.id ?? null,
      image_url: publicUrl,
      caption: "",
      status: "draft",
    });

    log.info({
      operation: "handleNewPost",
      message: "Image uploaded and post created",
      profileId,
      postId: post.id,
      durationMs: elapsed(),
    });

    return { postId: post.id, imageUrl: publicUrl, previewToken: post.preview_token };
  } catch (error) {
    log.error({
      operation: "handleNewPost",
      message: "Error creating post",
      profileId,
      error: serializeError(error),
    });
    await deliver(msgStr("genericError", channel));
    return null;
  }
}

/**
 * Resolve which organization a new post belongs to.
 * - 0 orgs: returns null
 * - 1 org: returns it directly
 * - 2+ orgs: uses an LLM to infer from the message body, falls back to first org
 */
async function resolveOrganization(
  client: DbClient,
  userId: string,
  messageBody?: string,
): Promise<Organization | null> {
  const orgs = await getOrganizationsForUser(client, userId);
  if (orgs.length === 0) return null;
  if (orgs.length === 1) return orgs[0];

  // Multiple orgs — try LLM disambiguation if we have a message
  if (messageBody) {
    try {
      const orgId = await inferOrganization(orgs, messageBody);
      if (orgId) {
        const match = orgs.find((o) => o.id === orgId);
        if (match) {
          log.info({
            operation: "handleNewPost.resolveOrg",
            message: "LLM resolved organization",
            orgId: match.id,
            orgName: match.name,
          });
          return match;
        }
      }
    } catch (err) {
      log.warn({
        operation: "handleNewPost.resolveOrg",
        message: "LLM org inference failed, using default",
        error: serializeError(err),
      });
    }
  }

  return orgs[0];
}

async function inferOrganization(
  orgs: Organization[],
  messageBody: string,
): Promise<string | null> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const orgList = orgs.map((o) => `- "${o.name}" (id: ${o.id})`).join("\n");

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    instructions: `You help route social media posts to the right organization.
Given a user's message and a list of organizations they belong to, determine which organization this post is most likely for.
Respond with ONLY the organization id, nothing else. If you cannot determine the organization, respond with "unknown".`,
    input: `Organizations:\n${orgList}\n\nUser message: "${messageBody}"`,
    max_output_tokens: 100,
  });

  const answer = response.output_text?.trim();
  if (!answer || answer === "unknown") return null;

  // Validate it's one of the actual org IDs
  const validIds = new Set(orgs.map((o) => o.id));
  return validIds.has(answer) ? answer : null;
}
