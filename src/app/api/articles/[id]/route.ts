import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { deleteArticle, updateArticle } from "@/lib/db/articles";
import { log, serializeError } from "@/lib/logger";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = createDbClient();

  try {
    await deleteArticle(db, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error({
      operation: "delete_article",
      message: "Failed to delete article",
      error: serializeError(err),
    });
    return NextResponse.json({ error: "Failed to delete article" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const db = createDbClient();

  const allowed = ["published", "published_at"] as const;
  const sanitized: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) sanitized[key] = body[key];
  }

  if (Object.keys(sanitized).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  try {
    await updateArticle(db, id, sanitized);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error({
      operation: "update_article",
      message: "Failed to update article",
      error: serializeError(err),
    });
    return NextResponse.json({ error: "Failed to update article" }, { status: 500 });
  }
}
