import { sendSms } from "@/lib/twilio/client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function routeMessage(
  profileId: string,
  phone: string,
  body: string,
  mediaUrl: string | null
) {
  const supabase = createAdminClient();
  const normalizedBody = body.toLowerCase().trim();

  // Check if user has completed onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, brand_name")
    .eq("id", profileId)
    .single();

  if (!profile?.onboarding_completed) {
    const reply =
      "Please complete your onboarding first! Visit your account at " +
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`;
    await sendSms(phone, reply);
    await logOutbound(supabase, profileId, phone, reply);
    return;
  }

  // Check for active draft
  const { data: activeDraft } = await supabase
    .from("posts")
    .select("*")
    .eq("profile_id", profileId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // HELP command
  const helpKeywords = ["help", "info", "support"];
  if (helpKeywords.includes(normalizedBody)) {
    const reply =
      "Post Imp Help:\n" +
      "📸 Send a photo + description to create a post\n" +
      "✅ Reply APPROVE to publish your draft\n" +
      "✏️ Reply with feedback to revise\n" +
      "❌ Reply CANCEL to discard draft\n\n" +
      "For support, visit https://postimp.com or email support@postimp.com. " +
      "To opt out, reply STOP.";
    await sendSms(phone, reply);
    await logOutbound(supabase, profileId, phone, reply);
    return;
  }

  // If there's a media URL, create a new draft (Phase 4)
  if (mediaUrl) {
    if (activeDraft) {
      // Cancel existing draft
      await supabase
        .from("posts")
        .update({ status: "cancelled" })
        .eq("id", activeDraft.id);
    }
    const { handleNewPost } = await import("@/lib/sms/handle-new-post");
    await handleNewPost(profileId, phone, body, mediaUrl);
    return;
  }

  // If there's an active draft, handle approve/revise/cancel
  if (activeDraft) {
    // Approve keywords
    const approveKeywords = [
      "approve",
      "yes",
      "looks good",
      "post it",
      "publish",
      "send it",
      "go",
      "perfect",
      "love it",
    ];
    if (approveKeywords.some((kw) => normalizedBody.includes(kw))) {
      const { handleApprove } = await import("@/lib/sms/handle-approve");
      await handleApprove(profileId, phone, activeDraft);
      return;
    }

    // Cancel keywords
    const cancelKeywords = ["cancel", "discard", "delete", "nevermind", "nvm"];
    if (cancelKeywords.some((kw) => normalizedBody.includes(kw))) {
      await supabase
        .from("posts")
        .update({ status: "cancelled" })
        .eq("id", activeDraft.id);
      const reply = "Draft cancelled. Send a new photo whenever you're ready!";
      await sendSms(phone, reply);
      await logOutbound(supabase, profileId, phone, reply);
      return;
    }

    // Otherwise treat as revision feedback
    const { handleRevise } = await import("@/lib/sms/handle-revise");
    await handleRevise(profileId, phone, activeDraft, body);
    return;
  }

  // No active draft, no media — prompt user
  const reply =
    "Send me a photo with a description and I'll create an Instagram post for you! 📸";
  await sendSms(phone, reply);
  await logOutbound(supabase, profileId, phone, reply);
}

async function logOutbound(
  supabase: ReturnType<typeof createAdminClient>,
  profileId: string,
  phone: string,
  body: string
) {
  await supabase.from("messages").insert({
    profile_id: profileId,
    phone,
    direction: "outbound",
    body,
  });
}
