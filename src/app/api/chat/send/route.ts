import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { makeWebDeliver } from "@/lib/core/deliver";
import { routeMessage } from "@/lib/core/router";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { body } = await request.json();
  if (!body || typeof body !== "string") {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Log inbound message (post_id set after routing)
  const { data: inboundMsg } = await admin
    .from("messages")
    .insert({
      profile_id: user.id,
      direction: "inbound",
      body,
      channel: "web",
    })
    .select("id")
    .single();

  const deliver = makeWebDeliver(admin, user.id);
  const result = await routeMessage(
    { profileId: user.id, body, mediaUrl: null, channel: "web" },
    deliver,
  );

  // Tag inbound message with post_id
  if (result.postId && inboundMsg) {
    await admin.from("messages").update({ post_id: result.postId }).eq("id", inboundMsg.id);
  }

  return NextResponse.json({ ok: true });
}
