import OpenAI from "openai";
import { log, timed } from "@/lib/logger";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/**
 * System prompt for generating and revising SEO blog articles.
 * Tweak this to change the tone and style of generated content.
 */
const ARTICLE_SYSTEM_PROMPT = `You are an expert content writer for Post Imp, an AI-powered social media manager. You write SEO-optimized blog articles that help small business owners and creators improve their social media presence.

Tone & Style:
- Friendly, approachable, and practical — like advice from a knowledgeable friend
- Use clear, simple language (no jargon unless you explain it)
- Write for people who are busy running a business, not marketing professionals
- Include actionable tips they can use immediately
- Be encouraging without being cheesy
- No em-dashes

Structure:
- Start with a compelling intro that hooks the reader (2-3 sentences, no filler)
- Use H2 (##) and H3 (###) headings to break up sections
- Keep paragraphs short (2-4 sentences)
- Include bullet points or numbered lists where they make the content scannable — always use at least 2 items per list but shoot for 3
- Don't end with an obvious "conclusion" or "wrapping up" section. Instead, close naturally — a final tip, a forward-looking thought, or a direct call-to-action works better

SEO Guidelines:
- Write for humans first, search engines second — but be deliberate about keyword placement
- Identify a primary keyword phrase for the topic. Place it in: the title (near the front), the slug, the meta description, the first paragraph, and at least one H2
- Use secondary/related keywords in other H2s and naturally throughout the body
- Write H2s and H3s as phrases people actually search for — think "People Also Ask" style questions and long-tail queries, not generic labels like "Tips" or "Overview"
- Near the top of key sections, include a concise 2-3 sentence answer or definition that directly addresses the heading — this is what search engines pull into featured snippets and AI overviews
- Meta description (the description field) is your search result ad copy — include the primary keyword, state the clear benefit, and give a reason to click. 150-160 characters
- Title should be specific and searchable — use formats like "How to...", "X Ways to...", "Guide to..." with the primary keyword near the front. Under 70 characters
- og_title and og_description are for social sharing — these can be more curiosity-driven and casual. title and description are for search — keyword-focused and precise
- Insert internal link placeholders where it makes sense to link to related articles or the product: {{internal-link: topic description}}. These will be converted to real links in post-processing
- Match the article structure to search intent: informational topics ("how to...") get step-by-step structure, comparison topics ("best...") get pros/cons or ranked lists, actionable topics ("ideas for...") get scannable list formats
- Aim for 800-1900 words — long enough to be comprehensive, short enough to stay focused

Interlinking (only when provided a list of existing blog articles):
- Link to relevant ones inline using markdown: [descriptive anchor text](/learn/slug)
- Only link to genuinely related articles — never force a link
- Aim for 2-4 inline links where natural
- At the end of the article, add a "Related Articles" section with 2-3 links to the most relevant existing articles, formatted as a bullet list of markdown links
- If no existing articles are provided, do not add any interlinks or a Related Articles section

Rules:
- When writing or revising an article, ALWAYS use the update_article tool. Include all fields every time — title, slug, description, content, tags, og_title, og_description.
- After calling update_article, briefly describe what you wrote or changed in your text response.
- When the user approves, says "publish it", "looks good", "ship it", or similar, call the publish_article tool.
- You can discuss the article, answer questions, or explain your choices without calling any tools.
- Stay focused on the article content — you help write blog posts, not general questions.`;

const tools: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "update_article",
    description:
      "Create or update the blog article. Call this whenever you write or revise any part of the article. Always include all fields.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Article title — primary keyword near the front, specific and searchable, under 70 characters",
        },
        slug: { type: "string", description: "URL-friendly slug with hyphens, include primary keyword" },
        description: {
          type: "string",
          description:
            "Meta description for search results — include primary keyword, state the benefit, 150-160 characters",
        },
        content: { type: "string", description: "Full article body in Markdown" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Relevant topic tags",
        },
        og_title: {
          type: "string",
          description: "Open Graph title optimized for social sharing",
        },
        og_description: {
          type: "string",
          description: "Open Graph description (under 200 chars)",
        },
      },
      required: ["title", "slug", "description", "content", "tags", "og_title", "og_description"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "publish_article",
    description:
      "Publish the article to the website. Call this when the user approves, says 'publish it', 'looks good', 'ship it', or similar.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
];

export interface ArticleToolCall {
  name: string;
  callId: string;
  args: Record<string, unknown>;
}

export interface SendArticleResult {
  responseId: string;
  textResponse: string;
  toolCalls: ArticleToolCall[];
}

export async function sendArticleMessage(params: {
  text: string;
  previousResponseId?: string | null;
}): Promise<SendArticleResult> {
  const { text, previousResponseId } = params;

  const elapsed = timed();
  const response = await getOpenAI().responses.create({
    model: "gpt-4o",
    instructions: ARTICLE_SYSTEM_PROMPT,
    input: [{ role: "user", content: text }],
    tools,
    ...(previousResponseId && { previous_response_id: previousResponseId }),
  });

  const result = parseResponse(response);
  log.info({
    operation: "openai.sendArticleMessage",
    message: "Article AI response received",
    durationMs: elapsed(),
    toolCallCount: result.toolCalls.length,
  });

  return result;
}

export async function sendArticleToolResults(params: {
  previousResponseId: string;
  toolOutputs: Array<{ callId: string; output: string }>;
}): Promise<SendArticleResult> {
  const { previousResponseId, toolOutputs } = params;

  const input: OpenAI.Responses.ResponseInput = toolOutputs.map((o) => ({
    type: "function_call_output" as const,
    call_id: o.callId,
    output: o.output,
  }));

  const elapsed = timed();
  const response = await getOpenAI().responses.create({
    model: "gpt-4o",
    instructions: ARTICLE_SYSTEM_PROMPT,
    input,
    tools,
    previous_response_id: previousResponseId,
  });

  const result = parseResponse(response);
  log.info({
    operation: "openai.sendArticleToolResults",
    message: "Article tool results response received",
    durationMs: elapsed(),
    toolCallCount: result.toolCalls.length,
  });

  return result;
}

function safeParse(json: string): Record<string, unknown> | null {
  try {
    return JSON.parse(json);
  } catch {
    log.warn({
      operation: "openai.parseResponse",
      message: "Malformed tool call JSON from OpenAI, skipping",
    });
    return null;
  }
}

function parseResponse(response: OpenAI.Responses.Response): SendArticleResult {
  let textResponse = "";
  const toolCalls: ArticleToolCall[] = [];

  for (const item of response.output) {
    if (item.type === "message") {
      for (const content of item.content) {
        if (content.type === "output_text") {
          textResponse += content.text;
        }
      }
    } else if (item.type === "function_call") {
      const args = safeParse(item.arguments);
      if (args) {
        toolCalls.push({ name: item.name, callId: item.call_id, args });
      }
    }
  }

  return { responseId: response.id, textResponse, toolCalls };
}
