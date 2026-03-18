import { createDbClient } from "@/lib/db/client";
import { updateThreadResponseId } from "@/lib/db/articles";
import { reviseArticle, type ArticleUpdateFields } from "@/lib/core/article-tools";
import { postSlackMessage } from "@/lib/slack/client";
import { log, timed, serializeError } from "@/lib/logger";

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

  let result;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://postimp.com";

    result = await reviseArticle(db, articleId, text, previousResponseId, {
      onUpdate: async (fields: ArticleUpdateFields) => {
        await postSlackMessage(
          channel,
          [
            `*Article updated*`,
            `*Title:* ${fields.title}`,
            `*Slug:* \`${fields.slug}\``,
            `*Description:* ${fields.description}`,
            `*Tags:* ${fields.tags.join(", ")}`,
            `Edit on web: ${baseUrl}/learn/write/${fields.slug}`,
          ].join("\n"),
          threadTs,
        );
      },
      onPublish: async (slug: string) => {
        await postSlackMessage(
          channel,
          `*Published!* The article is now live at: ${baseUrl}/learn/${slug}`,
          threadTs,
        );
      },
    });
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

  // Post AI's text response to thread
  if (result.textResponse) {
    await postSlackMessage(channel, result.textResponse, threadTs);
  }

  log.info({
    operation: "slack.orchestrateArticle",
    message: result.published ? "Article published" : "Article updated",
    articleId,
    durationMs: elapsed(),
    published: result.published,
  });

  return {
    published: result.published,
    articleFields: result.updatedFields ? { ...result.updatedFields } : undefined,
  };
}
