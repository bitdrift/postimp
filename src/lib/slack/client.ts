import { log } from "@/lib/logger";

export async function postSlackMessage(
  channel: string,
  text: string,
  threadTs?: string,
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    log.warn({ operation: "slack.postMessage", message: "SLACK_BOT_TOKEN not configured" });
    return;
  }

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      text,
      ...(threadTs && { thread_ts: threadTs }),
    }),
  });

  if (!res.ok) {
    log.error({
      operation: "slack.postMessage",
      message: `Slack HTTP error: ${res.status}`,
    });
    return;
  }

  const body = await res.json();
  if (!body.ok) {
    log.error({
      operation: "slack.postMessage",
      message: `Slack API error: ${body.error}`,
      channel,
    });
  }
}
