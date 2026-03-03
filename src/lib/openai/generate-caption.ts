import OpenAI from "openai";
import type { Profile, Post } from "@/lib/supabase/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface GenerateCaptionParams {
  imageUrl: string;
  userDescription: string;
  profile: Pick<
    Profile,
    "brand_name" | "brand_description" | "tone" | "target_audience"
  >;
  recentCaptions?: string[];
  revisionFeedback?: string;
  previousCaption?: string;
}

export async function generateCaption({
  imageUrl,
  userDescription,
  profile,
  recentCaptions = [],
  revisionFeedback,
  previousCaption,
}: GenerateCaptionParams): Promise<string> {
  const recentContext =
    recentCaptions.length > 0
      ? `\n\nRecent captions for consistency:\n${recentCaptions.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
      : "";

  const revisionContext = revisionFeedback
    ? `\n\nThe user wants revisions to this previous caption:\n"${previousCaption}"\n\nFeedback: "${revisionFeedback}"\nPlease revise the caption based on this feedback.`
    : "";

  const systemPrompt = `You are an expert social media manager creating Instagram captions.

Brand: ${profile.brand_name}
Brand Description: ${profile.brand_description}
Tone/Voice: ${profile.tone}
Target Audience: ${profile.target_audience}

Guidelines:
- Write an engaging Instagram caption that matches the brand voice
- Include relevant hashtags (5-10)
- Keep the caption concise but engaging
- Use line breaks for readability
- Don't use quotation marks around the caption
- The caption should feel authentic and on-brand${recentContext}${revisionContext}`;

  const userMessage = revisionFeedback
    ? "Please revise the caption based on the feedback provided."
    : `The user sent this photo with the description: "${userDescription}"\n\nWrite an Instagram caption for this image.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userMessage },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 500,
  });

  return response.choices[0].message.content || "Unable to generate caption.";
}
