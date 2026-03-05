import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getPostById, updatePost } from "@/lib/db/posts";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createDbClient();

  // Verify post belongs to user
  const post = await getPostById(db, postId, user.id);

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete
  await updatePost(db, postId, { status: "cancelled" });

  return NextResponse.json({ ok: true });
}
