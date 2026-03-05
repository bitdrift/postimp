import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const admin = createAdminClient();

  // Verify post belongs to user
  const { data: post } = await admin
    .from("posts")
    .select("id")
    .eq("id", postId)
    .eq("profile_id", user.id)
    .single();

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete
  await admin.from("posts").update({ status: "cancelled" }).eq("id", postId);

  return NextResponse.json({ ok: true });
}
