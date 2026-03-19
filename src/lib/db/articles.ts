import type { DbClient } from "./client";
import type { MarketingArticle, MarketingArticleThread } from "@/lib/supabase/types";

export type { MarketingArticle, MarketingArticleThread };

// ── Article queries ──────────────────────────────────────────

const ARTICLE_COLS =
  "id, slug, title, description, author, tags, published, published_at, og_title, og_description, og_image_url, canonical_url, created_at, updated_at" as const;

const DASHBOARD_PAGE_SIZE = 20;

export async function getArticlePage(
  client: DbClient,
  options?: { cursor?: string; filter?: "published" | "drafts" },
): Promise<{ articles: Omit<MarketingArticle, "content">[]; nextCursor: string | null }> {
  let query = client
    .from("marketing_articles")
    .select(ARTICLE_COLS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(DASHBOARD_PAGE_SIZE + 1);

  if (options?.filter === "published") query = query.eq("published", true);
  if (options?.filter === "drafts") query = query.eq("published", false);

  if (options?.cursor) {
    const sep = options.cursor.indexOf("|");
    const cursorDate = options.cursor.slice(0, sep);
    const cursorId = options.cursor.slice(sep + 1);
    if (
      !cursorDate ||
      !cursorId ||
      !/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/.test(cursorDate) ||
      !/^[0-9a-f-]{36}$/.test(cursorId)
    ) {
      throw new Error("Invalid cursor");
    }
    query = query.or(
      `created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const hasMore = data.length > DASHBOARD_PAGE_SIZE;
  const articles = hasMore ? data.slice(0, DASHBOARD_PAGE_SIZE) : data;
  const last = articles[articles.length - 1];
  const nextCursor = hasMore && last ? `${last.created_at}|${last.id}` : null;

  return { articles, nextCursor };
}

export async function getArticleCounts(
  client: DbClient,
): Promise<{ total: number; published: number; drafts: number }> {
  const [{ count: total, error: e1 }, { count: published, error: e2 }] = await Promise.all([
    client.from("marketing_articles").select("*", { count: "exact", head: true }),
    client
      .from("marketing_articles")
      .select("*", { count: "exact", head: true })
      .eq("published", true),
  ]);

  if (e1) throw e1;
  if (e2) throw e2;

  return {
    total: total ?? 0,
    published: published ?? 0,
    drafts: (total ?? 0) - (published ?? 0),
  };
}

export async function getPublishedArticles(
  client: DbClient,
): Promise<Omit<MarketingArticle, "content">[]> {
  const { data, error } = await client
    .from("marketing_articles")
    .select(ARTICLE_COLS)
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getArticleBySlug(
  client: DbClient,
  slug: string,
): Promise<MarketingArticle | null> {
  const { data, error } = await client
    .from("marketing_articles")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (error) return null;
  return data;
}

export async function insertArticle(
  client: DbClient,
  fields: {
    slug: string;
    title: string;
    description: string;
    content: string;
    author?: string;
    tags?: string[];
    published?: boolean;
    published_at?: string | null;
    og_title?: string | null;
    og_description?: string | null;
    og_image_url?: string | null;
    canonical_url?: string | null;
  },
): Promise<MarketingArticle> {
  const { data, error } = await client
    .from("marketing_articles")
    .insert(fields)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateArticle(
  client: DbClient,
  articleId: string,
  fields: Partial<
    Pick<
      MarketingArticle,
      | "slug"
      | "title"
      | "description"
      | "content"
      | "author"
      | "tags"
      | "published"
      | "published_at"
      | "og_title"
      | "og_description"
      | "og_image_url"
      | "canonical_url"
    >
  >,
): Promise<void> {
  const { error } = await client.from("marketing_articles").update(fields).eq("id", articleId);
  if (error) throw error;
}

/**
 * Fetches an article by slug regardless of published status.
 * Must be called with an admin client (service role) since RLS
 * restricts browser/server clients to published articles only.
 */
export async function getArticleBySlugWithDrafts(
  client: DbClient,
  slug: string,
): Promise<MarketingArticle | null> {
  const { data, error } = await client
    .from("marketing_articles")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return null;
  return data;
}

export async function getArticleById(
  client: DbClient,
  articleId: string,
): Promise<MarketingArticle | null> {
  const { data, error } = await client
    .from("marketing_articles")
    .select("*")
    .eq("id", articleId)
    .single();

  if (error) return null;
  return data;
}

export async function getAllPublishedSlugs(
  client: DbClient,
): Promise<{ slug: string; published_at: string | null }[]> {
  const { data, error } = await client
    .from("marketing_articles")
    .select("slug, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getPublishedArticlesByTag(
  client: DbClient,
  tag: string,
): Promise<Omit<MarketingArticle, "content">[]> {
  const { data, error } = await client
    .from("marketing_articles")
    .select(ARTICLE_COLS)
    .eq("published", true)
    .contains("tags", [tag])
    .order("published_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getPublishedArticleSummaries(
  client: DbClient,
): Promise<{ slug: string; title: string; tags: string[] }[]> {
  const { data, error } = await client
    .from("marketing_articles")
    .select("slug, title, tags")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) return [];
  return data;
}

export async function getAllSlugs(client: DbClient): Promise<string[]> {
  const { data, error } = await client.from("marketing_articles").select("slug");

  if (error) return [];
  return data.map((row) => row.slug);
}

// ── Thread queries ───────────────────────────────────────────

export async function insertArticleThread(
  client: DbClient,
  fields: {
    article_id: string;
    slack_channel_id: string;
    slack_thread_ts: string;
    openai_response_id?: string | null;
    created_by_slack_user?: string | null;
  },
): Promise<MarketingArticleThread> {
  const { data, error } = await client
    .from("marketing_article_threads")
    .insert(fields)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getThreadBySlack(
  client: DbClient,
  channelId: string,
  threadTs: string,
): Promise<(MarketingArticleThread & { article: MarketingArticle }) | null> {
  const { data, error } = await client
    .from("marketing_article_threads")
    .select("*, article:marketing_articles(*)")
    .eq("slack_channel_id", channelId)
    .eq("slack_thread_ts", threadTs)
    .single();

  if (error) return null;
  return data as MarketingArticleThread & { article: MarketingArticle };
}

export async function updateThreadResponseId(
  client: DbClient,
  threadId: string,
  responseId: string,
): Promise<void> {
  const { error } = await client
    .from("marketing_article_threads")
    .update({ openai_response_id: responseId })
    .eq("id", threadId);

  if (error) throw error;
}
