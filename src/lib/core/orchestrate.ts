import { createDbClient } from "@/lib/db/client";
import { getProfile } from "@/lib/db/profiles";
import { getActiveDraft, updatePost } from "@/lib/db/posts";
import { sendMessage, sendToolResults, type SendMessageResult } from "@/lib/openai/conversation";
import { uploadAndCreatePost, type ImageSource } from "./handle-new-post";
import { executePublish } from "./handle-approve";
import { msgStr, formatCaptionMessage } from "./messages";
import type { MessageContext, DeliverFn } from "./types";

export interface OrchestrateResult {
  postId?: string;
  imageUrl?: string;
}

export async function orchestrate(
  ctx: MessageContext,
  deliver: DeliverFn,
): Promise<OrchestrateResult> {
  const db = createDbClient();

  // Pre-AI guard: onboarding check
  const profile = await getProfile(db, ctx.profileId);

  if (!profile?.onboarding_completed) {
    await deliver(msgStr("onboardingIncomplete", ctx.channel));
    return {};
  }

  // Pre-AI guard: handle media upload
  const hasMedia = ctx.mediaUrl || ctx.imageBuffer;
  let newPostResult: { postId: string; imageUrl: string; previewToken: string } | null = null;

  if (hasMedia) {
    const source: ImageSource =
      ctx.imageBuffer && ctx.contentType
        ? { kind: "buffer", imageBuffer: ctx.imageBuffer, contentType: ctx.contentType }
        : { kind: "url", mediaUrl: ctx.mediaUrl! };

    newPostResult = await uploadAndCreatePost(ctx.profileId, source, ctx.channel, deliver);
    if (!newPostResult) return {};
  }

  // Resolve which post to chat about
  let postId: string;
  let imageUrl: string;
  let previewToken: string;
  let conversationId: string | null;

  if (newPostResult) {
    postId = newPostResult.postId;
    imageUrl = newPostResult.imageUrl;
    previewToken = newPostResult.previewToken;
    conversationId = null;
  } else if (ctx.postId) {
    // Specific post targeted (e.g. from thread view)
    const post = await db
      .from("posts")
      .select("*")
      .eq("id", ctx.postId)
      .eq("profile_id", ctx.profileId)
      .single();
    if (!post.data) {
      await deliver(msgStr("genericError", ctx.channel));
      return {};
    }
    postId = post.data.id;
    imageUrl = post.data.image_url;
    previewToken = post.data.preview_token;
    conversationId = post.data.openai_conversation_id;
  } else {
    // No specific post — fall back to most recent draft (SMS flow)
    const existingDraft = await getActiveDraft(db, ctx.profileId);
    if (!existingDraft) {
      await deliver(msgStr("noDraftPrompt", ctx.channel));
      return {};
    }
    postId = existingDraft.id;
    imageUrl = existingDraft.image_url;
    previewToken = existingDraft.preview_token;
    conversationId = existingDraft.openai_conversation_id;
  }

  // Send message to AI
  let result: SendMessageResult;
  try {
    result = await sendMessage({
      text: ctx.body || "Create a caption for this image.",
      imageUrl: newPostResult ? imageUrl : undefined,
      previousResponseId: conversationId,
      profile,
      channel: ctx.channel,
    });
  } catch (error) {
    console.error("AI conversation error:", error);
    await deliver(msgStr("genericError", ctx.channel), postId);
    return { postId, imageUrl };
  }

  // Save conversation ID on first call
  if (!conversationId && result.responseId) {
    await updatePost(db, postId, { openai_conversation_id: result.responseId });
  }

  // Tool execution loop
  let currentResult = result;
  const MAX_TOOL_ROUNDS = 5;

  for (let round = 0; round < MAX_TOOL_ROUNDS && currentResult.toolCalls.length > 0; round++) {
    const toolOutputs: Array<{ callId: string; output: string }> = [];

    for (const toolCall of currentResult.toolCalls) {
      if (toolCall.name === "update_caption") {
        const caption = toolCall.args.caption as string;
        await updatePost(db, postId, { caption });

        const previewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/preview/${previewToken}`;
        await deliver(formatCaptionMessage(caption, previewUrl, ctx.channel), postId);

        toolOutputs.push({ callId: toolCall.callId, output: "Caption updated successfully." });
      } else if (toolCall.name === "publish_post") {
        // Re-fetch post to get latest caption
        const latestPost = await db.from("posts").select("*").eq("id", postId).single();
        if (!latestPost.data) {
          toolOutputs.push({ callId: toolCall.callId, output: "Error: post not found." });
          continue;
        }

        const publishResult = await executePublish(ctx.profileId, latestPost.data);

        if (publishResult.success) {
          toolOutputs.push({
            callId: toolCall.callId,
            output: "Post published successfully to Instagram!",
          });
        } else {
          toolOutputs.push({
            callId: toolCall.callId,
            output: `Publishing failed: ${publishResult.error}`,
          });
        }
      }
    }

    // Send tool results back to AI for follow-up
    try {
      currentResult = await sendToolResults({
        previousResponseId: currentResult.responseId,
        toolOutputs,
        profile,
        channel: ctx.channel,
      });

      // Update conversation ID to latest response
      await updatePost(db, postId, { openai_conversation_id: currentResult.responseId });
    } catch (error) {
      console.error("AI tool result error:", error);
      break;
    }
  }

  // Deliver AI's text response
  if (currentResult.textResponse) {
    await deliver(currentResult.textResponse, postId);
  }

  return { postId, imageUrl };
}
