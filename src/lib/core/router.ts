import { createAdminClient } from "@/lib/supabase/admin";
import { msgStr } from "./messages";
import type { MessageContext, DeliverFn } from "./types";

export async function routeMessage(ctx: MessageContext, deliver: DeliverFn) {
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
    return;
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
    return;
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

    await handleNewPost(ctx.profileId, ctx.body, ctx.channel, deliver, source);
    return;
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
      return;
    }

    const cancelKeywords = ["cancel", "discard", "delete", "nevermind", "nvm"];
    if (cancelKeywords.some((kw) => normalizedBody.includes(kw))) {
      await supabase
        .from("posts")
        .update({ status: "cancelled" })
        .eq("id", activeDraft.id);
      await deliver(msgStr("draftCancelled", ctx.channel));
      return;
    }

    // Otherwise treat as revision feedback
    const { handleRevise } = await import("@/lib/core/handle-revise");
    await handleRevise(ctx.profileId, activeDraft, ctx.body, ctx.channel, deliver);
    return;
  }

  // No active draft, no media — prompt user
  await deliver(msgStr("noDraftPrompt", ctx.channel));
}
