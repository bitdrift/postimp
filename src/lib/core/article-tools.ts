import type { DbClient } from "@/lib/db/client";
import {
  updateArticle,
  getArticleById,
  getAllSlugs,
  getPublishedArticleSummaries,
} from "@/lib/db/articles";
import {
  sendArticleMessage,
  sendArticleToolResults,
  type SendArticleResult,
} from "@/lib/openai/article-writer";
import { log, serializeError } from "@/lib/logger";
import type { MarketingArticle } from "@/lib/supabase/types";

const MAX_TOOL_ROUNDS = 5;
const MAX_CONTEXT_CONTENT_LENGTH = 3000;

export interface ArticleUpdateFields {
  title: string;
  slug: string;
  description: string;
  content: string;
  tags: string[];
  og_title: string;
  og_description: string;
}

export interface CaptureDraftResult {
  responseId: string;
  textResponse: string;
  articleFields: ArticleUpdateFields | null;
}

export type ArticleSummary = { slug: string; title: string; tags: string[] };

/**
 * Builds an AI prompt that includes the current article as context,
 * used when resuming a draft without prior conversation history.
 * Truncates content to avoid inflating token cost.
 * Filters out the current article from the catalog to prevent self-linking.
 */
export function buildArticleContext(
  article: MarketingArticle,
  feedback: string,
  existingArticles?: ArticleSummary[],
): string {
  const truncatedContent =
    article.content.length > MAX_CONTEXT_CONTENT_LENGTH
      ? article.content.slice(0, MAX_CONTEXT_CONTENT_LENGTH) + "\n\n[content truncated]"
      : article.content;

  const parts = [
    "Here is the current draft article:",
    "",
    `Title: ${article.title}`,
    `Slug: ${article.slug}`,
    `Description: ${article.description}`,
    `Tags: ${article.tags.join(", ")}`,
    "",
    "Content:",
    truncatedContent,
  ];

  const filtered = existingArticles?.filter((a) => a.slug !== article.slug);
  if (filtered && filtered.length > 0) {
    parts.push("", "---", "", ...formatArticleCatalog(filtered));
  }

  parts.push("", "---", "", `User feedback: ${feedback}`);

  return parts.join("\n");
}

function formatArticleCatalog(articles: ArticleSummary[]): string[] {
  return [
    "Here are the existing published articles on the blog. Link to relevant ones inline using [anchor text](/learn/slug):",
    "",
    ...articles.map((a) => `- "${a.title}" (/learn/${a.slug}) [tags: ${a.tags.join(", ")}]`),
  ];
}

/**
 * Extracts internal /learn/ links from article markdown content
 * and checks that every linked slug exists in the database.
 * Returns the list of broken slugs (empty if all valid).
 */
export async function validateArticleLinks(db: DbClient, content: string): Promise<string[]> {
  const linkPattern = /\]\(\/learn\/([a-zA-Z0-9_-]+)\)/g;
  const linkedSlugs = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(content)) !== null) {
    linkedSlugs.add(match[1]);
  }

  if (linkedSlugs.size === 0) return [];

  const existingSlugs = new Set(await getAllSlugs(db));
  return [...linkedSlugs].filter((slug) => !existingSlugs.has(slug));
}

/**
 * Sends an idea to the AI and captures the generated article fields
 * without writing to the database. Used for initial draft creation
 * by both the Slack bot and the web UI.
 */
export async function captureDraftFromAI(
  idea: string,
  existingArticles?: ArticleSummary[],
): Promise<CaptureDraftResult> {
  const parts: string[] = [];

  if (existingArticles && existingArticles.length > 0) {
    parts.push(...formatArticleCatalog(existingArticles), "");
  }

  parts.push(`Write a blog article based on this idea:\n\n${idea}`);

  let result = await sendArticleMessage({
    text: parts.join("\n"),
  });

  let articleFields: ArticleUpdateFields | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS && result.toolCalls.length > 0; round++) {
    const toolOutputs = result.toolCalls.map((toolCall) => {
      if (toolCall.name === "update_article") {
        articleFields = toolCall.args as unknown as ArticleUpdateFields;
        return { callId: toolCall.callId, output: "Article saved as draft." };
      }
      if (toolCall.name === "publish_article") {
        return {
          callId: toolCall.callId,
          output: "Article saved as draft. The user will review before publishing.",
        };
      }
      return { callId: toolCall.callId, output: `Unknown tool: ${toolCall.name}` };
    });

    result = await sendArticleToolResults({
      previousResponseId: result.responseId,
      toolOutputs,
    });
  }

  return {
    responseId: result.responseId,
    textResponse: result.textResponse,
    articleFields,
  };
}

export interface ReviseArticleResult {
  responseId: string;
  textResponse: string;
  published: boolean;
  updatedFields: ArticleUpdateFields | null;
}

export interface ReviseArticleCallbacks {
  onUpdate?: (fields: ArticleUpdateFields) => Promise<void>;
  onPublish?: (slug: string) => Promise<void>;
}

/**
 * Sends feedback to the AI and executes tool calls against the database.
 * Used for article revisions by both the Slack bot and the web UI.
 * Optional callbacks allow channel-specific side effects (e.g. Slack notifications).
 *
 * When previousResponseId is null (conversation history lost), automatically
 * fetches the current article and existing article catalog to rebuild context.
 */
export async function reviseArticle(
  db: DbClient,
  articleId: string,
  text: string,
  previousResponseId: string | null,
  callbacks?: ReviseArticleCallbacks,
): Promise<ReviseArticleResult> {
  // When conversation history is lost, rebuild context with article + catalog
  let messageText = text;
  if (!previousResponseId) {
    const article = await getArticleById(db, articleId);
    if (article) {
      const summaries = await getPublishedArticleSummaries(db);
      messageText = buildArticleContext(article, text, summaries);
    } else {
      log.warn({
        operation: "core.reviseArticle",
        message: "Article not found when rebuilding context",
        articleId,
      });
    }
  }

  let result: SendArticleResult;
  try {
    result = await sendArticleMessage({ text: messageText, previousResponseId });
  } catch (error) {
    log.error({
      operation: "core.reviseArticle",
      message: "AI message failed",
      articleId,
      error: serializeError(error),
    });
    throw error;
  }

  let published = false;
  let currentResult = result;
  let updatedFields: ArticleUpdateFields | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS && currentResult.toolCalls.length > 0; round++) {
    const toolOutputs: Array<{ callId: string; output: string }> = [];

    for (const toolCall of currentResult.toolCalls) {
      log.info({
        operation: "core.reviseArticle.toolCall",
        message: `Executing tool: ${toolCall.name}`,
        articleId,
        toolName: toolCall.name,
        round,
      });

      if (toolCall.name === "update_article") {
        const fields = toolCall.args as unknown as ArticleUpdateFields;
        await updateArticle(db, articleId, fields);
        updatedFields = fields;
        if (callbacks?.onUpdate) await callbacks.onUpdate(fields);
        toolOutputs.push({ callId: toolCall.callId, output: "Article updated successfully." });
      } else if (toolCall.name === "publish_article") {
        const article = await getArticleById(db, articleId);
        const publishFields: Record<string, unknown> = {
          published: true,
          published_at: new Date().toISOString(),
        };

        if (article) {
          const brokenLinks = await validateArticleLinks(db, article.content);
          if (brokenLinks.length > 0) {
            log.warn({
              operation: "core.reviseArticle.publish",
              message: "Removing broken internal links before publish",
              articleId,
              brokenSlugs: brokenLinks,
            });
            let cleanedContent = article.content;
            for (const slug of brokenLinks) {
              cleanedContent = cleanedContent.replace(
                new RegExp(`\\[([^\\]]+)\\]\\(/learn/${slug}\\)`, "g"),
                "$1",
              );
            }
            publishFields.content = cleanedContent;
          }
        }

        await updateArticle(db, articleId, publishFields);
        published = true;
        const slug = article?.slug || "unknown";
        if (callbacks?.onPublish) await callbacks.onPublish(slug);
        toolOutputs.push({ callId: toolCall.callId, output: "Article published successfully!" });
      } else {
        toolOutputs.push({ callId: toolCall.callId, output: `Unknown tool: ${toolCall.name}` });
      }
    }

    try {
      currentResult = await sendArticleToolResults({
        previousResponseId: currentResult.responseId,
        toolOutputs,
      });
    } catch (error) {
      log.error({
        operation: "core.reviseArticle.toolResults",
        message: "AI tool result error",
        articleId,
        round,
        error: serializeError(error),
      });
      break;
    }
  }

  return {
    responseId: currentResult.responseId,
    textResponse: currentResult.textResponse,
    published,
    updatedFields,
  };
}
