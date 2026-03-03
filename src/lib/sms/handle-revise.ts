import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/twilio/client";
import { generateCaption } from "@/lib/openai/generate-caption";
import type { Post } from "@/lib/supabase/types";

export async function handleRevise(
  profileId: string,
  phone: string,
  post: Post,
  feedback: string
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
      await sendSmsAndLog(
        supabase,
        profileId,
        phone,
        "Error loading your profile. Please try again."
      );
      return;
    }

    await sendSmsAndLog(
      supabase,
      profileId,
      phone,
      "Got it! Working on a revision..."
    );

    // Generate revised caption
    const newCaption = await generateCaption({
      imageUrl: post.image_url,
      userDescription: "",
      profile,
      revisionFeedback: feedback,
      previousCaption: post.caption || "",
    });

    // Update post caption
    await supabase
      .from("posts")
      .update({ caption: newCaption })
      .eq("id", post.id);

    const previewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/preview/${post.preview_token}`;
    const truncatedCaption =
      newCaption.length > 300
        ? newCaption.substring(0, 297) + "..."
        : newCaption;

    const reply =
      `Revised caption:\n\n${truncatedCaption}\n\n` +
      `Preview: ${previewUrl}\n\n` +
      `Reply APPROVE to publish, send more feedback, or CANCEL.`;

    await sendSmsAndLog(supabase, profileId, phone, reply);
  } catch (error) {
    console.error("Error revising post:", error);
    await sendSmsAndLog(
      supabase,
      profileId,
      phone,
      "Sorry, something went wrong revising your caption. Please try again."
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
