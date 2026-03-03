import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/twilio/client";
import { generateCaption } from "@/lib/openai/generate-caption";

export async function handleNewPost(
  profileId: string,
  phone: string,
  description: string,
  mediaUrl: string
) {
  const supabase = createAdminClient();

  try {
    // Download image from Twilio (requires Basic auth)
    const twilioAuth = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString("base64");

    const imageResponse = await fetch(mediaUrl, {
      headers: { Authorization: `Basic ${twilioAuth}` },
    });

    if (!imageResponse.ok) {
      await sendSmsAndLog(
        supabase,
        profileId,
        phone,
        "Sorry, I couldn't download your image. Please try sending it again."
      );
      return;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType =
      imageResponse.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const fileName = `${profileId}/${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(fileName, imageBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      await sendSmsAndLog(
        supabase,
        profileId,
        phone,
        "Sorry, there was an error uploading your image. Please try again."
      );
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("post-images").getPublicUrl(fileName);

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

    // Get recent captions for consistency
    const { data: recentPosts } = await supabase
      .from("posts")
      .select("caption")
      .eq("profile_id", profileId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(5);

    const recentCaptions = (recentPosts || [])
      .map((p) => p.caption)
      .filter(Boolean) as string[];

    // Generate caption with AI
    const caption = await generateCaption({
      imageUrl: publicUrl,
      userDescription: description,
      profile,
      recentCaptions,
    });

    // Create draft post
    const { data: post } = await supabase
      .from("posts")
      .insert({
        profile_id: profileId,
        image_url: publicUrl,
        caption,
        status: "draft",
      })
      .select("preview_token")
      .single();

    // Send caption preview via SMS
    const previewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/preview/${post!.preview_token}`;
    const truncatedCaption =
      caption.length > 300 ? caption.substring(0, 297) + "..." : caption;

    const reply =
      `Here's your draft caption:\n\n${truncatedCaption}\n\n` +
      `Preview: ${previewUrl}\n\n` +
      `Reply APPROVE to publish, send feedback to revise, or CANCEL to discard.`;

    await sendSmsAndLog(supabase, profileId, phone, reply);
  } catch (error) {
    console.error("Error creating post:", error);
    await sendSmsAndLog(
      supabase,
      profileId,
      phone,
      "Sorry, something went wrong creating your post. Please try again."
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
