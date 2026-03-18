import type { DbClient } from "@/lib/db/client";
import { updateArticle, getArticleById } from "@/lib/db/articles";
import {
  sendArticleMessage,
  sendArticleToolResults,
  type SendArticleResult,
} from "@/lib/openai/article-writer";
import { log, serializeError } from "@/lib/logger";

const MAX_TOOL_ROUNDS = 5;

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

/**
 * Sends an idea to the AI and captures the generated article fields
 * without writing to the database. Used for initial draft creation
 * by both the Slack bot and the web UI.
 */
export async function captureDraftFromAI(idea: string): Promise<CaptureDraftResult> {
  let result = await sendArticleMessage({
    text: `Write a blog article based on this idea:\n\n${idea}`,
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
 */
export async function reviseArticle(
  db: DbClient,
  articleId: string,
  text: string,
  previousResponseId: string | null,
  callbacks?: ReviseArticleCallbacks,
): Promise<ReviseArticleResult> {
  let result: SendArticleResult;
  try {
    result = await sendArticleMessage({ text, previousResponseId });
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
        await updateArticle(db, articleId, {
          published: true,
          published_at: new Date().toISOString(),
        });
        published = true;
        const article = await getArticleById(db, articleId);
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
