import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function sha256Short(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (key !== "value") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const botToken = process.env.SLACK_BOT_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  return NextResponse.json({
    SLACK_BOT_TOKEN: botToken ? { set: true, hash: sha256Short(botToken) } : { set: false },
    SLACK_SIGNING_SECRET: signingSecret
      ? { set: true, hash: sha256Short(signingSecret) }
      : { set: false },
  });
}
