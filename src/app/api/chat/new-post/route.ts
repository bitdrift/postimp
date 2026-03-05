import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { makeWebDeliver } from "@/lib/core/deliver";
import { handleNewPost } from "@/lib/core/handle-new-post";

export async function POST(request: NextRequest) {
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

  const admin = createAdminClient();

  // Cancel any existing draft
  await admin
    .from("posts")
    .update({ status: "cancelled" })
    .eq("profile_id", user.id)
    .eq("status", "draft");

  const imageBuffer = await file.arrayBuffer();
  const contentType = file.type || "image/jpeg";

  const deliver = makeWebDeliver(admin, user.id);

  const postId = await handleNewPost(user.id, body, "web", deliver, {
    kind: "buffer",
    imageBuffer,
    contentType,
  });

  if (!postId) {
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }

  // Log inbound message with post_id
  await admin.from("messages").insert({
    profile_id: user.id,
    direction: "inbound",
    body: body || "(photo)",
    channel: "web",
    post_id: postId,
  });

  return NextResponse.json({ postId });
}
