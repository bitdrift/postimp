import OpenAI from "openai";
import type { Profile } from "@/lib/db/profiles";
import type { MessageChannel } from "@/lib/db/messages";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
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

const tools: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "update_caption",
    description:
      "Update the Instagram caption for the current post. Call this whenever you write or revise a caption.",
    parameters: {
      type: "object",
      properties: {
        caption: {
          type: "string",
          description: "The full Instagram caption text",
        },
      },
      required: ["caption"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "publish_post",
    description:
      "Publish the current post to Instagram. Call this when the user approves, wants to publish, or says something like 'post it', 'looks good', 'send it'.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
];

export interface ToolCall {
  name: string;
  callId: string;
  args: Record<string, unknown>;
}

export interface SendMessageResult {
  responseId: string;
  textResponse: string;
  toolCalls: ToolCall[];
}

export function buildSystemPrompt(
  profile: Pick<
    Profile,
    "brand_name" | "brand_description" | "tone" | "caption_style" | "target_audience"
  >,
  channel: MessageChannel,
): string {
  const guidelines = styleGuidelines[profile.caption_style] || styleGuidelines.polished;
  const channelNote =
    channel === "sms"
      ? "\n\nThe user is chatting via SMS. Keep your text responses very concise (under 160 characters when possible)."
      : "";

  return `You are Post Imp, an AI social media manager helping create Instagram posts.

Brand: ${profile.brand_name}
Brand Description: ${profile.brand_description}
Tone/Voice: ${profile.tone}
Target Audience: ${profile.target_audience}

Caption Style Guidelines:
${guidelines}
- The caption should feel authentic and on-brand
- Don't use quotation marks around the caption

Rules:
- When writing or revising a caption, ALWAYS use the update_caption tool. Never put the full caption in your text response.
- When you call update_caption, just comment briefly on the caption in your text response (e.g. "Here's a caption focused on..."). The system displays the caption separately.
- When the user wants to publish/approve/post, call the publish_post tool.
- You can answer questions about the post, caption, or social media strategy without calling any tools.
- Stay on topic — you help with Instagram posts, not general questions.${channelNote}`;
}

export async function sendMessage(params: {
  text: string;
  imageUrl?: string;
  previousResponseId?: string | null;
  profile: Pick<
    Profile,
    "brand_name" | "brand_description" | "tone" | "caption_style" | "target_audience"
  >;
  channel: MessageChannel;
}): Promise<SendMessageResult> {
  const { text, imageUrl, previousResponseId, profile, channel } = params;

  const input: OpenAI.Responses.ResponseInput = [];

  if (imageUrl) {
    input.push({
      role: "user",
      content: [
        { type: "input_text", text: text || "Create a caption for this image." },
        { type: "input_image", image_url: imageUrl, detail: "auto" },
      ],
    });
  } else {
    input.push({
      role: "user",
      content: text,
    });
  }

  const response = await getOpenAI().responses.create({
    model: "gpt-4o",
    instructions: buildSystemPrompt(profile, channel),
    input,
    tools,
    ...(previousResponseId && { previous_response_id: previousResponseId }),
  });

  return parseResponse(response);
}

export async function sendToolResults(params: {
  previousResponseId: string;
  toolOutputs: Array<{ callId: string; output: string }>;
  profile: Pick<
    Profile,
    "brand_name" | "brand_description" | "tone" | "caption_style" | "target_audience"
  >;
  channel: MessageChannel;
}): Promise<SendMessageResult> {
  const { previousResponseId, toolOutputs, profile, channel } = params;

  const input: OpenAI.Responses.ResponseInput = toolOutputs.map((o) => ({
    type: "function_call_output" as const,
    call_id: o.callId,
    output: o.output,
  }));

  const response = await getOpenAI().responses.create({
    model: "gpt-4o",
    instructions: buildSystemPrompt(profile, channel),
    input,
    tools,
    previous_response_id: previousResponseId,
  });

  return parseResponse(response);
}

function parseResponse(response: OpenAI.Responses.Response): SendMessageResult {
  let textResponse = "";
  const toolCalls: ToolCall[] = [];

  for (const item of response.output) {
    if (item.type === "message") {
      for (const content of item.content) {
        if (content.type === "output_text") {
          textResponse += content.text;
        }
      }
    } else if (item.type === "function_call") {
      toolCalls.push({
        name: item.name,
        callId: item.call_id,
        args: JSON.parse(item.arguments),
      });
    }
  }

  return {
    responseId: response.id,
    textResponse,
    toolCalls,
  };
}
