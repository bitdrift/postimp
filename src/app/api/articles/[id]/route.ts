import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getArticleById, updateArticle } from "@/lib/db/articles";
import { log, serializeError } from "@/lib/logger";

const MAX_CONTENT_LENGTH = 50_000;

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.content || typeof body.content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  if (body.content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content too long (max ${MAX_CONTENT_LENGTH} characters)` },
      { status: 400 },
    );
  }

  const db = createDbClient();

  try {
    const existing = await getArticleById(db, id);
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    if (existing.published) {
      return NextResponse.json({ error: "Cannot edit a published article" }, { status: 400 });
    }

    await updateArticle(db, id, { content: body.content });
    const updated = await getArticleById(db, id);

    log.info({
      operation: "api.articles.patch",
      message: "Article content manually edited",
      articleId: id,
    });

    return NextResponse.json({
      article: updated
        ? {
            title: updated.title,
            slug: updated.slug,
            description: updated.description,
            content: updated.content,
            tags: updated.tags,
            published: updated.published,
          }
        : null,
    });
  } catch (err) {
    log.error({
      operation: "api.articles.patch",
      message: "Article patch error",
      error: serializeError(err),
    });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
