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

  // Log inbound message
  await admin.from("messages").insert({
    profile_id: user.id,
    direction: "inbound",
    body,
    channel: "web",
  });

  const deliver = makeWebDeliver(admin, user.id);
  await routeMessage(
    { profileId: user.id, body, mediaUrl: null, channel: "web" },
    deliver
  );

  return NextResponse.json({ ok: true });
}
