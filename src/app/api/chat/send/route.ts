import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { insertMessage, updateMessage } from "@/lib/db/messages";
import { makeWebDeliver } from "@/lib/core/deliver";
import { routeMessage } from "@/lib/core/router";
import { log, timed } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const elapsed = timed();
  log.info({ operation: "api.chat.send", message: "POST /api/chat/send" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { body, postId } = await request.json();
  if (!body || typeof body !== "string") {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const db = createDbClient();

  // Log inbound message (post_id set after routing if not provided)
  const inboundMsg = await insertMessage(db, {
    profile_id: user.id,
    direction: "inbound",
    body,
    channel: "web",
    ...(postId && { post_id: postId }),
  });

  const deliver = makeWebDeliver(db, user.id);
  const result = await routeMessage(
    { profileId: user.id, body, mediaUrl: null, channel: "web", postId: postId || undefined },
    deliver,
  );

  // Tag inbound message with post_id
  if (result.postId && inboundMsg) {
    await updateMessage(db, inboundMsg.id, { post_id: result.postId });
  }

  log.info({
    operation: "api.chat.send",
    message: "POST /api/chat/send completed",
    durationMs: elapsed(),
  });

  return NextResponse.json({ ok: true });
}
