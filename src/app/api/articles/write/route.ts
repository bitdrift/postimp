import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { insertArticle, getArticleById, getPublishedArticleSummaries } from "@/lib/db/articles";
import { captureDraftFromAI, reviseArticle } from "@/lib/core/article-tools";
import { log, timed, serializeError } from "@/lib/logger";

const MAX_MESSAGE_LENGTH = 5000;

export async function POST(request: NextRequest) {
  const elapsed = timed();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { message: string; articleId?: string; responseId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, articleId, responseId } = body;
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` },
      { status: 400 },
    );
  }

  const db = createDbClient();
  const authorName = user.user_metadata?.full_name || user.email || "Post Imp Team";

  try {
    if (!articleId) {
      return await handleNewArticle(db, message, authorName, elapsed);
    }

    // Verify article exists
    const existing = await getArticleById(db, articleId);
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return await handleRevision(db, message, articleId, responseId || null, elapsed);
  } catch (err) {
    log.error({
      operation: "api.articles.write",
      message: "Article write error",
      error: serializeError(err),
    });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

async function handleNewArticle(
  db: ReturnType<typeof createDbClient>,
  idea: string,
  author: string,
  elapsed: ReturnType<typeof timed>,
) {
  const summaries = await getPublishedArticleSummaries(db);
  const draft = await captureDraftFromAI(idea, summaries);

  if (!draft.articleFields) {
    return NextResponse.json(
      { error: "AI didn't generate article content. Try again." },
      { status: 500 },
    );
  }

  const fields = draft.articleFields;

  let saved;
  try {
    saved = await insertArticle(db, {
      slug: fields.slug,
      title: fields.title,
      description: fields.description,
      content: fields.content,
      tags: fields.tags,
      og_title: fields.og_title || null,
      og_description: fields.og_description || null,
      author,
      published: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("duplicate") || message.includes("unique")) {
      return NextResponse.json(
        {
          error: `An article with the slug "${fields.slug}" already exists. Try a different topic or wording.`,
        },
        { status: 409 },
      );
    }
    throw err;
  }

  log.info({
    operation: "api.articles.write.new",
    message: "Article drafted via web",
    durationMs: elapsed(),
    slug: saved.slug,
  });

  return NextResponse.json({
    articleId: saved.id,
    responseId: draft.responseId,
    textResponse: draft.textResponse,
    article: {
      title: saved.title,
      slug: saved.slug,
      description: saved.description,
      content: saved.content,
      tags: saved.tags,
      published: false,
    },
  });
}

async function handleRevision(
  db: ReturnType<typeof createDbClient>,
  feedback: string,
  articleId: string,
  previousResponseId: string | null,
  elapsed: ReturnType<typeof timed>,
) {
  let result;
  try {
    result = await reviseArticle(db, articleId, feedback, previousResponseId);
  } catch {
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }

  const article = await getArticleById(db, articleId);

  log.info({
    operation: "api.articles.write.revise",
    message: result.published ? "Article published via web" : "Article revised via web",
    durationMs: elapsed(),
    articleId,
    published: result.published,
  });

  return NextResponse.json({
    articleId,
    responseId: result.responseId,
    textResponse: result.textResponse,
    published: result.published,
    article: article
      ? {
          title: article.title,
          slug: article.slug,
          description: article.description,
          content: article.content,
          tags: article.tags,
          published: article.published,
        }
      : null,
  });
}
