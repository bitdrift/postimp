import { after } from "next/server";
import { NextResponse, type NextRequest } from "next/server";
import { verifySlackRequest } from "@/lib/slack/verify";
import { postSlackMessage } from "@/lib/slack/client";
import { orchestrateArticle } from "@/lib/slack/orchestrate-article";
import { createDbClient } from "@/lib/db/client";
import { insertArticle, insertArticleThread, getThreadBySlack } from "@/lib/db/articles";
import { captureDraftFromAI } from "@/lib/core/article-tools";
import { log, timed, serializeError } from "@/lib/logger";

const GENERIC_ERROR_REPLY = "Something went wrong. Please try again.";

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
        try {
          await postSlackMessage(event.channel, GENERIC_ERROR_REPLY, event.ts);
        } catch (slackErr) {
          log.warn({
            operation: "api.webhooks.slack",
            message: "Failed to send error reply to Slack",
            error: serializeError(slackErr),
          });
        }
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
        try {
          await postSlackMessage(event.channel, GENERIC_ERROR_REPLY, event.thread_ts);
        } catch (slackErr) {
          log.warn({
            operation: "api.webhooks.slack",
            message: "Failed to send error reply to Slack",
            error: serializeError(slackErr),
          });
        }
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
    const draft = await captureDraftFromAI(idea);

    if (!draft.articleFields) {
      await postSlackMessage(
        event.channel,
        "Something went wrong — AI didn't generate article content. Try again.",
        event.ts,
      );
      return;
    }

    const db = createDbClient();
    const fields = draft.articleFields;
    const saved = await insertArticle(db, {
      slug: fields.slug,
      title: fields.title,
      description: fields.description,
      content: fields.content,
      tags: fields.tags,
      og_title: fields.og_title || null,
      og_description: fields.og_description || null,
      author: "Post Imp Team",
      published: false,
    });

    await insertArticleThread(db, {
      article_id: saved.id,
      slack_channel_id: event.channel,
      slack_thread_ts: event.ts,
      openai_response_id: draft.responseId,
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
        `Edit on web: ${baseUrl}/admin/blog/write/${saved.slug}`,
        `Once published it will appear at: ${baseUrl}/learn/${saved.slug}`,
      ].join("\n"),
      event.ts,
    );

    if (draft.textResponse) {
      await postSlackMessage(event.channel, draft.textResponse, event.ts);
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

    try {
      await postSlackMessage(
        event.channel,
        "Something went wrong generating that article. Please try again.",
        event.ts,
      );
    } catch (slackErr) {
      log.warn({
        operation: "api.webhooks.slack.newArticle",
        message: "Failed to send error reply to Slack",
        error: serializeError(slackErr),
      });
    }
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
