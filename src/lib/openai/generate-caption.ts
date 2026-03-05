import OpenAI from "openai";
import type { Profile } from "@/lib/db/profiles";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

interface GenerateCaptionParams {
  imageUrl: string;
  userDescription: string;
  profile: Pick<
    Profile,
    "brand_name" | "brand_description" | "tone" | "caption_style" | "target_audience"
  >;
  recentCaptions?: string[];
  revisionFeedback?: string;
  previousCaption?: string;
}

const styleGuidelines: Record<string, string> = {
  polished: `- Write a structured, polished Instagram caption
- Use a catchy opening hook
- Include emojis where they feel natural
- Include relevant hashtags (5-10)
- Use line breaks for readability`,

  casual: `- Write like a real person posting to their own feed — natural and conversational
- Keep it short and unforced — no hooks or marketing language
- Use emojis sparingly or not at all
- Include 0-3 hashtags at most, only if they feel natural
- Avoid heavy formatting or structure`,

  minimal: `- Write a very short, clean caption — one or two sentences max
- No hashtags
- No emojis
- No line breaks or formatting tricks
- Let the image speak for itself`,
};

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

  const guidelines = styleGuidelines[profile.caption_style] || styleGuidelines.polished;

  const systemPrompt = `You are an expert social media manager creating Instagram captions.

Brand: ${profile.brand_name}
Brand Description: ${profile.brand_description}
Tone/Voice: ${profile.tone}
Target Audience: ${profile.target_audience}

Guidelines:
${guidelines}
- The caption should feel authentic and on-brand
- Don't use quotation marks around the caption${recentContext}${revisionContext}`;

  const userMessage = revisionFeedback
    ? "Please revise the caption based on the feedback provided."
    : `The user sent this photo with the description: "${userDescription}"\n\nWrite an Instagram caption for this image.`;

  const response = await getOpenAI().chat.completions.create({
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
