import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getMessages } from "@/lib/db/messages";
import { log, timed, serializeError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const elapsed = timed();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");

  const db = createDbClient();

  try {
    const messages = await getMessages(db, user.id, {
      channel: "web",
      ascending: true,
      ...(before && { before }),
    });

    log.info({
      operation: "api.chat.messages",
      message: "GET /api/chat/messages completed",
      durationMs: elapsed(),
    });

    return NextResponse.json({ messages });
  } catch (error) {
    log.error({
      operation: "api.chat.messages",
      message: "GET /api/chat/messages failed",
      durationMs: elapsed(),
      error: serializeError(error),
    });
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
