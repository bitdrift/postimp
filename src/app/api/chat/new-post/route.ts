import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { insertMessage } from "@/lib/db/messages";
import { makeWebDeliver } from "@/lib/core/deliver";
import { routeMessage } from "@/lib/core/router";
import { log, timed } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const elapsed = timed();
  log.info({ operation: "api.chat.newPost", message: "POST /api/chat/new-post" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("image") as File | null;
  const body = (formData.get("body") as string) || "";

  if (!file) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }

  const imageBuffer = await file.arrayBuffer();
  const contentType = file.type || "image/jpeg";

  const db = createDbClient();
  const deliver = makeWebDeliver(db, user.id);

  const result = await routeMessage(
    {
      profileId: user.id,
      body,
      mediaUrl: null,
      channel: "web",
      imageBuffer,
      contentType,
    },
    deliver,
  );

  if (!result.postId) {
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }

  // Log inbound message with post_id and image
  await insertMessage(db, {
    profile_id: user.id,
    direction: "inbound",
    body: body || "(photo)",
    channel: "web",
    post_id: result.postId,
    media_url: result.imageUrl || null,
  });

  log.info({
    operation: "api.chat.newPost",
    message: "POST /api/chat/new-post completed",
    postId: result.postId,
    durationMs: elapsed(),
  });

  return NextResponse.json({ postId: result.postId });
}
