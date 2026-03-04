import { createAdminClient } from "@/lib/supabase/admin";
import { msgStr, msgFn1 } from "./messages";
import type { MessageContext, DeliverFn } from "./types";

export interface RouteResult {
  postId?: string;
}

export async function routeMessage(ctx: MessageContext, deliver: DeliverFn): Promise<RouteResult> {
  const supabase = createAdminClient();
  const normalizedBody = ctx.body.toLowerCase().trim();

  // Check if user has completed onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, brand_name")
    .eq("id", ctx.profileId)
    .single();

  if (!profile?.onboarding_completed) {
    await deliver(msgStr("onboardingIncomplete", ctx.channel));
    return {};
  }

  // Check for active draft
  const { data: activeDraft } = await supabase
    .from("posts")
    .select("*")
    .eq("profile_id", ctx.profileId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // HELP command
  const helpKeywords = ["help", "info", "support"];
  if (helpKeywords.includes(normalizedBody)) {
    await deliver(msgStr("help", ctx.channel));
    return {};
  }

  // SMS: SET CAPTION / CAPTION: command
  if (ctx.channel === "sms" && activeDraft) {
    const captionPrefixes = ["set caption:", "caption:"];
    const matchedPrefix = captionPrefixes.find((p) => normalizedBody.startsWith(p));
    if (matchedPrefix) {
      const newCaption = ctx.body.slice(matchedPrefix.length).trim();
      if (newCaption) {
        await supabase
          .from("posts")
          .update({ caption: newCaption })
          .eq("id", activeDraft.id);

        const previewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/preview/${activeDraft.preview_token}`;
        await deliver(
          (msgFn1("captionSet", ctx.channel) as (url: string) => string)(previewUrl),
          activeDraft.id
        );
        return { postId: activeDraft.id };
      }
    }
  }

  // If there's media, create a new draft
  const hasMedia = ctx.mediaUrl || ctx.imageBuffer;
  if (hasMedia) {
    if (activeDraft) {
      await supabase
        .from("posts")
        .update({ status: "cancelled" })
        .eq("id", activeDraft.id);
    }

    const { handleNewPost } = await import("@/lib/core/handle-new-post");

    const source = ctx.imageBuffer && ctx.contentType
      ? { kind: "buffer" as const, imageBuffer: ctx.imageBuffer, contentType: ctx.contentType }
      : { kind: "url" as const, mediaUrl: ctx.mediaUrl! };

    const postId = await handleNewPost(ctx.profileId, ctx.body, ctx.channel, deliver, source);
    return { postId: postId || undefined };
  }

  // If there's an active draft, handle approve/revise/cancel
  if (activeDraft) {
    const approveKeywords = [
      "approve", "yes", "looks good", "post it", "publish",
      "send it", "go", "perfect", "love it",
    ];
    if (approveKeywords.some((kw) => normalizedBody.includes(kw))) {
      const { handleApprove } = await import("@/lib/core/handle-approve");
      await handleApprove(ctx.profileId, activeDraft, ctx.channel, deliver);
      return { postId: activeDraft.id };
    }

    const cancelKeywords = ["cancel", "discard", "delete", "nevermind", "nvm"];
    if (cancelKeywords.some((kw) => normalizedBody.includes(kw))) {
      await supabase
        .from("posts")
        .update({ status: "cancelled" })
        .eq("id", activeDraft.id);
      await deliver(msgStr("draftCancelled", ctx.channel), activeDraft.id);
      return { postId: activeDraft.id };
    }

    // Otherwise treat as revision feedback
    const { handleRevise } = await import("@/lib/core/handle-revise");
    await handleRevise(ctx.profileId, activeDraft, ctx.body, ctx.channel, deliver);
    return { postId: activeDraft.id };
  }

  // No active draft, no media — prompt user
  await deliver(msgStr("noDraftPrompt", ctx.channel));
  return {};
}
