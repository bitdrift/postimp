import { createDbClient } from "@/lib/db/client";
import { updateArticle, updateThreadResponseId, getArticleById } from "@/lib/db/articles";
import {
  sendArticleMessage,
  sendArticleToolResults,
  type SendArticleResult,
} from "@/lib/openai/article-writer";
import { postSlackMessage } from "@/lib/slack/client";
import { log, timed, serializeError } from "@/lib/logger";

const MAX_TOOL_ROUNDS = 5;

export interface OrchestrateArticleParams {
  articleId: string;
  threadId: string;
  text: string;
  previousResponseId: string | null;
  channel: string;
  threadTs: string;
}

export interface OrchestrateArticleResult {
  published: boolean;
  articleFields?: Record<string, unknown>;
}

export async function orchestrateArticle(
  params: OrchestrateArticleParams,
): Promise<OrchestrateArticleResult> {
  const { articleId, threadId, text, previousResponseId, channel, threadTs } = params;
  const db = createDbClient();
  const elapsed = timed();

  let result: SendArticleResult;
  try {
    result = await sendArticleMessage({ text, previousResponseId });
  } catch (error) {
    log.error({
      operation: "slack.orchestrateArticle",
      message: "AI message failed",
      articleId,
      error: serializeError(error),
    });
    await postSlackMessage(
      channel,
      "Something went wrong talking to AI. Please try again.",
      threadTs,
    );
    return { published: false };
  }

  // Update conversation pointer
  await updateThreadResponseId(db, threadId, result.responseId);

  // Tool execution loop
  let currentResult = result;
  let published = false;
  let lastArticleFields: Record<string, unknown> | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS && currentResult.toolCalls.length > 0; round++) {
    const toolOutputs: Array<{ callId: string; output: string }> = [];

    for (const toolCall of currentResult.toolCalls) {
      log.info({
        operation: "slack.orchestrateArticle.toolCall",
        message: `Executing tool: ${toolCall.name}`,
        articleId,
        toolName: toolCall.name,
        round,
      });

      if (toolCall.name === "update_article") {
        const fields = toolCall.args as {
          title: string;
          slug: string;
          description: string;
          content: string;
          tags: string[];
          og_title: string;
          og_description: string;
        };

        await updateArticle(db, articleId, fields);
        lastArticleFields = fields;

        await postSlackMessage(
          channel,
          [
            `*Article updated*`,
            `*Title:* ${fields.title}`,
            `*Slug:* \`${fields.slug}\``,
            `*Description:* ${fields.description}`,
            `*Tags:* ${fields.tags.join(", ")}`,
          ].join("\n"),
          threadTs,
        );

        toolOutputs.push({ callId: toolCall.callId, output: "Article updated successfully." });
      } else if (toolCall.name === "publish_article") {
        await updateArticle(db, articleId, {
          published: true,
          published_at: new Date().toISOString(),
        });
        published = true;

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://postimp.com";
        const article = await getArticleById(db, articleId);
        const slug = article?.slug || "unknown";

        await postSlackMessage(
          channel,
          `*Published!* The article is now live at: ${baseUrl}/learn/${slug}`,
          threadTs,
        );

        toolOutputs.push({ callId: toolCall.callId, output: "Article published successfully!" });
      } else {
        toolOutputs.push({ callId: toolCall.callId, output: `Unknown tool: ${toolCall.name}` });
      }
    }

    // Send tool results back to AI
    try {
      currentResult = await sendArticleToolResults({
        previousResponseId: currentResult.responseId,
        toolOutputs,
      });

      await updateThreadResponseId(db, threadId, currentResult.responseId);
    } catch (error) {
      log.error({
        operation: "slack.orchestrateArticle.toolResults",
        message: "AI tool result error",
        articleId,
        round,
        error: serializeError(error),
      });
      break;
    }
  }

  // Post AI's text response to thread
  if (currentResult.textResponse) {
    await postSlackMessage(channel, currentResult.textResponse, threadTs);
  }

  log.info({
    operation: "slack.orchestrateArticle",
    message: published ? "Article published" : "Article updated",
    articleId,
    durationMs: elapsed(),
    published,
  });

  return { published, articleFields: lastArticleFields };
}
