import { after } from "next/server";
import { NextResponse, type NextRequest } from "next/server";
import { verifySlackRequest } from "@/lib/slack/verify";
import { postSlackMessage } from "@/lib/slack/client";
import { orchestrateArticle } from "@/lib/slack/orchestrate-article";
import { createDbClient } from "@/lib/db/client";
import { insertArticle, insertArticleThread, getThreadBySlack } from "@/lib/db/articles";
import { sendArticleMessage, sendArticleToolResults } from "@/lib/openai/article-writer";
import { log, timed, serializeError } from "@/lib/logger";

// Track recently processed event IDs to prevent duplicate handling from Slack retries
const recentEventIds = new Set<string>();
const MAX_EVENT_CACHE = 1000;

function isDuplicateEvent(eventId: string): boolean {
  if (recentEventIds.has(eventId)) return true;
  recentEventIds.add(eventId);
  if (recentEventIds.size > MAX_EVENT_CACHE) {
    const first = recentEventIds.values().next().value;
    if (first) recentEventIds.delete(first);
  }
  return false;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const body = JSON.parse(rawBody);

  // Slack URL verification challenge
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Verify request signature
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    log.warn({
      operation: "api.webhooks.slack",
      message: "SLACK_SIGNING_SECRET not configured — rejecting request",
    });
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const timestamp = request.headers.get("x-slack-request-timestamp") || "";
  const signature = request.headers.get("x-slack-signature") || "";

  if (!verifySlackRequest(signingSecret, { timestamp, signature }, rawBody)) {
    log.warn({ operation: "api.webhooks.slack", message: "Invalid Slack signature" });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  // Deduplicate retried events
  if (body.event_id && isDuplicateEvent(body.event_id)) {
    return NextResponse.json({ ok: true });
  }

  const event = body.event;
  if (!event) return NextResponse.json({ ok: true });

  if (event.type === "app_mention") {
    after(async () => {
      try {
        await handleNewArticle(event);
      } catch (err) {
        log.error({
          operation: "api.webhooks.slack",
          message: "Background handleNewArticle failed",
          error: serializeError(err),
        });
      }
    });
  } else if (event.type === "message" && event.thread_ts && !event.bot_id && !event.subtype) {
    after(async () => {
      try {
        await handleThreadReply(event);
      } catch (err) {
        log.error({
          operation: "api.webhooks.slack",
          message: "Background handleThreadReply failed",
          error: serializeError(err),
        });
      }
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleNewArticle(event: {
  text: string;
  channel: string;
  user: string;
  ts: string;
}) {
  const elapsed = timed();
  const idea = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();

  if (!idea) {
    await postSlackMessage(
      event.channel,
      "I need an article idea! Mention me with a topic, like: `@Post Imp 10 tips for writing better Instagram captions`",
      event.ts,
    );
    return;
  }

  await postSlackMessage(
    event.channel,
    `Writing an article about: _${idea}_\nThis will take a minute...`,
    event.ts,
  );

  try {
    // Send to AI — it should call update_article tool with initial draft
    let result = await sendArticleMessage({
      text: `Write a blog article based on this idea:\n\n${idea}`,
    });

    // Extract article fields from the first update_article tool call.
    // This initial loop only captures fields and responds to tool calls —
    // it intentionally differs from orchestrateArticle because the article
    // row doesn't exist in the DB yet.
    let articleFields: Record<string, unknown> | null = null;
    const MAX_ROUNDS = 5;

    for (let round = 0; round < MAX_ROUNDS && result.toolCalls.length > 0; round++) {
      const toolOutputs: Array<{ callId: string; output: string }> = [];

      for (const toolCall of result.toolCalls) {
        if (toolCall.name === "update_article") {
          articleFields = toolCall.args;
          toolOutputs.push({ callId: toolCall.callId, output: "Article saved as draft." });
        } else if (toolCall.name === "publish_article") {
          toolOutputs.push({
            callId: toolCall.callId,
            output: "Article saved as draft. The team will review before publishing.",
          });
        } else {
          toolOutputs.push({
            callId: toolCall.callId,
            output: `Unknown tool: ${toolCall.name}`,
          });
        }
      }

      result = await sendArticleToolResults({
        previousResponseId: result.responseId,
        toolOutputs,
      });
    }

    if (!articleFields) {
      await postSlackMessage(
        event.channel,
        "Something went wrong — AI didn't generate article content. Try again.",
        event.ts,
      );
      return;
    }

    // Save article and thread
    const db = createDbClient();
    const saved = await insertArticle(db, {
      slug: articleFields.slug as string,
      title: articleFields.title as string,
      description: articleFields.description as string,
      content: articleFields.content as string,
      tags: articleFields.tags as string[],
      og_title: (articleFields.og_title as string) || null,
      og_description: (articleFields.og_description as string) || null,
      author: "Post Imp Team",
      published: false,
    });

    await insertArticleThread(db, {
      article_id: saved.id,
      slack_channel_id: event.channel,
      slack_thread_ts: event.ts,
      openai_response_id: result.responseId,
      created_by_slack_user: event.user,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://postimp.com";

    await postSlackMessage(
      event.channel,
      [
        `*Article drafted!*`,
        `*Title:* ${saved.title}`,
        `*Slug:* \`${saved.slug}\``,
        `*Description:* ${saved.description}`,
        `*Tags:* ${saved.tags.join(", ")}`,
        ``,
        `Reply in this thread to give feedback and I'll revise. Say *publish it* when you're happy.`,
        `Once published it will appear at: ${baseUrl}/learn/${saved.slug}`,
      ].join("\n"),
      event.ts,
    );

    if (result.textResponse) {
      await postSlackMessage(event.channel, result.textResponse, event.ts);
    }

    log.info({
      operation: "api.webhooks.slack.newArticle",
      message: "Article generated and saved as draft",
      durationMs: elapsed(),
      slug: saved.slug,
      channel: event.channel,
    });
  } catch (err) {
    log.error({
      operation: "api.webhooks.slack.newArticle",
      message: "Failed to generate article",
      error: serializeError(err),
    });

    await postSlackMessage(
      event.channel,
      "Something went wrong generating that article. Please try again.",
      event.ts,
    );
  }
}

async function handleThreadReply(event: {
  text: string;
  channel: string;
  user: string;
  ts: string;
  thread_ts: string;
}) {
  const db = createDbClient();

  const thread = await getThreadBySlack(db, event.channel, event.thread_ts);
  if (!thread) return;

  const feedback = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
  if (!feedback) return;

  await orchestrateArticle({
    articleId: thread.article_id,
    threadId: thread.id,
    text: feedback,
    previousResponseId: thread.openai_response_id,
    channel: event.channel,
    threadTs: event.thread_ts,
  });
}
