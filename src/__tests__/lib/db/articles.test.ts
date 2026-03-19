import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import {
  getArticlePage,
  getArticleCounts,
  getPublishedArticles,
  getArticleBySlug,
  getArticleBySlugWithDrafts,
  getAllPublishedSlugs,
  getPublishedArticlesByTag,
  getPublishedArticleSummaries,
  getAllSlugs,
  insertArticle,
  updateArticle,
  insertArticleThread,
  getThreadBySlack,
  updateThreadResponseId,
} from "@/lib/db/articles";

const db = createDbClient();
const NIL = "00000000-0000-0000-0000-000000000000";

async function seedArticle(overrides: Record<string, unknown> = {}) {
  const { data, error } = await db
    .from("marketing_articles")
    .insert({
      slug: `test-article-${crypto.randomUUID().slice(0, 8)}`,
      title: "Test Article",
      description: "A test article description",
      content: "# Hello\n\nThis is test content.",
      author: "Post Imp Team",
      tags: ["test"],
      published: true,
      published_at: new Date().toISOString(),
      ...overrides,
    })
    .select("id, slug")
    .single();

  if (error) throw new Error(`seedArticle: ${error.message}`);
  return data!;
}

async function cleanAll() {
  await db.from("marketing_article_threads").delete().neq("id", NIL);
  await db.from("marketing_articles").delete().neq("id", NIL);
}

describe("marketing_articles", () => {
  afterEach(async () => {
    await cleanAll();
  });

  describe("getArticlePage", () => {
    it("returns first page of articles ordered by created_at desc", async () => {
      await seedArticle({ slug: "older", created_at: "2026-01-01T00:00:00Z" });
      await seedArticle({ slug: "newer", created_at: "2026-03-01T00:00:00Z" });

      const { articles, nextCursor } = await getArticlePage(db);

      expect(articles).toHaveLength(2);
      expect(articles[0].slug).toBe("newer");
      expect(articles[1].slug).toBe("older");
      expect(nextCursor).toBeNull();
    });

    it("filters by published status", async () => {
      await seedArticle({ slug: "pub", published: true });
      await seedArticle({ slug: "draft", published: false });

      const pubResult = await getArticlePage(db, { filter: "published" });
      expect(pubResult.articles).toHaveLength(1);
      expect(pubResult.articles[0].slug).toBe("pub");

      const draftResult = await getArticlePage(db, { filter: "drafts" });
      expect(draftResult.articles).toHaveLength(1);
      expect(draftResult.articles[0].slug).toBe("draft");
    });

    it("returns nextCursor when more pages exist and advances with cursor", async () => {
      // Seed 22 articles (page size is 20)
      const promises = [];
      for (let i = 0; i < 22; i++) {
        promises.push(
          seedArticle({
            slug: `page-${String(i).padStart(2, "0")}`,
            created_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
          }),
        );
      }
      await Promise.all(promises);

      const page1 = await getArticlePage(db);

      expect(page1.articles).toHaveLength(20);
      expect(page1.nextCursor).not.toBeNull();
      // First article should be the newest (i=21 → Jan 22)
      expect(page1.articles[0].slug).toBe("page-21");

      const page2 = await getArticlePage(db, { cursor: page1.nextCursor! });

      expect(page2.articles).toHaveLength(2);
      expect(page2.nextCursor).toBeNull();
      // Last two should be the oldest
      expect(page2.articles[0].slug).toBe("page-01");
      expect(page2.articles[1].slug).toBe("page-00");
    });

    it("paginates within a filter", async () => {
      // Seed 22 drafts + 1 published
      const promises = [];
      for (let i = 0; i < 22; i++) {
        promises.push(
          seedArticle({
            slug: `draft-${String(i).padStart(2, "0")}`,
            published: false,
            created_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
          }),
        );
      }
      promises.push(seedArticle({ slug: "published-one", published: true }));
      await Promise.all(promises);

      const page1 = await getArticlePage(db, { filter: "drafts" });

      expect(page1.articles).toHaveLength(20);
      expect(page1.nextCursor).not.toBeNull();
      expect(page1.articles.every((a) => !a.published)).toBe(true);

      const page2 = await getArticlePage(db, { filter: "drafts", cursor: page1.nextCursor! });

      expect(page2.articles).toHaveLength(2);
      expect(page2.nextCursor).toBeNull();
      expect(page2.articles.every((a) => !a.published)).toBe(true);
    });

    it("does not include content field", async () => {
      await seedArticle();

      const { articles } = await getArticlePage(db);

      expect(articles[0]).not.toHaveProperty("content");
    });
  });

  describe("getArticleCounts", () => {
    it("returns total, published, and draft counts", async () => {
      await seedArticle({ slug: "pub-1", published: true });
      await seedArticle({ slug: "pub-2", published: true });
      await seedArticle({ slug: "draft-1", published: false });

      const counts = await getArticleCounts(db);

      expect(counts.total).toBe(3);
      expect(counts.published).toBe(2);
      expect(counts.drafts).toBe(1);
    });

    it("returns zeros when no articles exist", async () => {
      const counts = await getArticleCounts(db);

      expect(counts).toEqual({ total: 0, published: 0, drafts: 0 });
    });
  });

  describe("getPublishedArticles", () => {
    it("returns published articles ordered by date", async () => {
      await seedArticle({
        slug: "older-post",
        title: "Older Post",
        published_at: "2026-01-01T00:00:00Z",
      });
      await seedArticle({
        slug: "newer-post",
        title: "Newer Post",
        published_at: "2026-03-01T00:00:00Z",
      });

      const articles = await getPublishedArticles(db);

      expect(articles).toHaveLength(2);
      expect(articles[0].title).toBe("Newer Post");
      expect(articles[1].title).toBe("Older Post");
    });

    it("excludes unpublished articles", async () => {
      await seedArticle({ slug: "published", published: true });
      await seedArticle({ slug: "draft", published: false });

      const articles = await getPublishedArticles(db);

      expect(articles).toHaveLength(1);
      expect(articles[0].slug).toBe("published");
    });

    it("does not include content field", async () => {
      await seedArticle();

      const articles = await getPublishedArticles(db);

      expect(articles).toHaveLength(1);
      expect(articles[0]).not.toHaveProperty("content");
    });
  });

  describe("getArticleBySlug", () => {
    it("returns a published article with content", async () => {
      const { slug } = await seedArticle({ content: "# Full content here" });

      const article = await getArticleBySlug(db, slug);

      expect(article).not.toBeNull();
      expect(article!.slug).toBe(slug);
      expect(article!.content).toBe("# Full content here");
    });

    it("returns null for unpublished articles", async () => {
      const { slug } = await seedArticle({ published: false });

      const article = await getArticleBySlug(db, slug);

      expect(article).toBeNull();
    });

    it("returns null for non-existent slugs", async () => {
      const article = await getArticleBySlug(db, "does-not-exist");

      expect(article).toBeNull();
    });

    it("includes SEO fields", async () => {
      const { slug } = await seedArticle({
        og_title: "Custom OG Title",
        og_description: "Custom OG Description",
        og_image_url: "https://example.com/image.jpg",
        canonical_url: "https://example.com/canonical",
      });

      const article = await getArticleBySlug(db, slug);

      expect(article!.og_title).toBe("Custom OG Title");
      expect(article!.og_description).toBe("Custom OG Description");
      expect(article!.og_image_url).toBe("https://example.com/image.jpg");
      expect(article!.canonical_url).toBe("https://example.com/canonical");
    });
  });

  describe("getArticleBySlugWithDrafts", () => {
    it("returns a published article", async () => {
      const { slug } = await seedArticle({ published: true });

      const article = await getArticleBySlugWithDrafts(db, slug);

      expect(article).not.toBeNull();
      expect(article!.slug).toBe(slug);
    });

    it("returns an unpublished draft article", async () => {
      const { slug } = await seedArticle({ published: false });

      const article = await getArticleBySlugWithDrafts(db, slug);

      expect(article).not.toBeNull();
      expect(article!.slug).toBe(slug);
      expect(article!.published).toBe(false);
    });

    it("returns null for non-existent slugs", async () => {
      const article = await getArticleBySlugWithDrafts(db, "does-not-exist");

      expect(article).toBeNull();
    });
  });

  describe("getAllPublishedSlugs", () => {
    it("returns slugs and published_at for published articles", async () => {
      await seedArticle({ slug: "slug-one", published_at: "2026-02-01T00:00:00Z" });
      await seedArticle({ slug: "slug-two", published_at: "2026-03-01T00:00:00Z" });
      await seedArticle({ slug: "draft-slug", published: false });

      const slugs = await getAllPublishedSlugs(db);

      expect(slugs).toHaveLength(2);
      expect(slugs[0].slug).toBe("slug-two");
      expect(slugs[1].slug).toBe("slug-one");
      expect(slugs[0].published_at).toBeTruthy();
    });
  });

  describe("getPublishedArticlesByTag", () => {
    it("returns published articles matching the tag", async () => {
      await seedArticle({ slug: "tagged-a", tags: ["instagram", "tips"] });
      await seedArticle({ slug: "tagged-b", tags: ["instagram"] });
      await seedArticle({ slug: "untagged", tags: ["facebook"] });

      const articles = await getPublishedArticlesByTag(db, "instagram");

      expect(articles).toHaveLength(2);
      const slugs = articles.map((a) => a.slug);
      expect(slugs).toContain("tagged-a");
      expect(slugs).toContain("tagged-b");
    });

    it("excludes unpublished articles", async () => {
      await seedArticle({ slug: "pub-tag", tags: ["seo"], published: true });
      await seedArticle({ slug: "draft-tag", tags: ["seo"], published: false });

      const articles = await getPublishedArticlesByTag(db, "seo");

      expect(articles).toHaveLength(1);
      expect(articles[0].slug).toBe("pub-tag");
    });

    it("returns empty array for non-existent tag", async () => {
      const articles = await getPublishedArticlesByTag(db, "nonexistent");

      expect(articles).toEqual([]);
    });

    it("does not include content field", async () => {
      await seedArticle({ tags: ["check"] });

      const articles = await getPublishedArticlesByTag(db, "check");

      expect(articles).toHaveLength(1);
      expect(articles[0]).not.toHaveProperty("content");
    });
  });

  describe("getPublishedArticleSummaries", () => {
    it("returns slug, title, and tags for published articles", async () => {
      await seedArticle({ slug: "summary-a", title: "Article A", tags: ["a"] });
      await seedArticle({ slug: "summary-b", title: "Article B", tags: ["b"], published: false });

      const summaries = await getPublishedArticleSummaries(db);

      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toEqual({
        slug: "summary-a",
        title: "Article A",
        tags: ["a"],
      });
    });

    it("orders by published_at descending", async () => {
      await seedArticle({
        slug: "older",
        title: "Older",
        published_at: "2026-01-01T00:00:00Z",
      });
      await seedArticle({
        slug: "newer",
        title: "Newer",
        published_at: "2026-03-01T00:00:00Z",
      });

      const summaries = await getPublishedArticleSummaries(db);

      expect(summaries[0].title).toBe("Newer");
      expect(summaries[1].title).toBe("Older");
    });
  });

  describe("getAllSlugs", () => {
    it("returns slugs for both published and unpublished articles", async () => {
      await seedArticle({ slug: "published-slug", published: true });
      await seedArticle({ slug: "draft-slug", published: false });

      const slugs = await getAllSlugs(db);

      expect(slugs).toContain("published-slug");
      expect(slugs).toContain("draft-slug");
    });

    it("returns empty array when no articles exist", async () => {
      const slugs = await getAllSlugs(db);

      expect(slugs).toEqual([]);
    });
  });

  describe("insertArticle", () => {
    it("creates an article and returns it with all fields", async () => {
      const article = await insertArticle(db, {
        slug: "new-article",
        title: "New Article",
        description: "A new article",
        content: "# Content",
        tags: ["social", "tips"],
        og_title: "OG Title",
        og_description: "OG Desc",
      });

      expect(article.id).toBeTruthy();
      expect(article.slug).toBe("new-article");
      expect(article.title).toBe("New Article");
      expect(article.tags).toEqual(["social", "tips"]);
      expect(article.published).toBe(false);
      expect(article.author).toBe("Post Imp Team");
    });

    it("throws on duplicate slug", async () => {
      await seedArticle({ slug: "duplicate" });

      await expect(
        insertArticle(db, {
          slug: "duplicate",
          title: "Another",
          description: "Desc",
          content: "Content",
        }),
      ).rejects.toThrow();
    });
  });

  describe("updateArticle", () => {
    it("updates specified fields", async () => {
      const { id, slug } = await seedArticle({ title: "Original" });

      await updateArticle(db, id, { title: "Updated Title", description: "Updated desc" });

      const article = await getArticleBySlug(db, slug);
      expect(article!.title).toBe("Updated Title");
      expect(article!.description).toBe("Updated desc");
    });

    it("can publish an article", async () => {
      const { id, slug } = await seedArticle({ published: false });

      expect(await getArticleBySlug(db, slug)).toBeNull();

      await updateArticle(db, id, {
        published: true,
        published_at: new Date().toISOString(),
      });

      const article = await getArticleBySlug(db, slug);
      expect(article).not.toBeNull();
      expect(article!.published).toBe(true);
    });
  });
});

describe("marketing_article_threads", () => {
  afterEach(async () => {
    await cleanAll();
  });

  it("insertArticleThread creates a thread and getThreadBySlack retrieves it", async () => {
    const article = await insertArticle(db, {
      slug: "thread-test",
      title: "Thread Test",
      description: "Desc",
      content: "Content",
    });

    const thread = await insertArticleThread(db, {
      article_id: article.id,
      slack_channel_id: "C123",
      slack_thread_ts: "1234567890.123456",
      openai_response_id: "resp_abc",
      created_by_slack_user: "U456",
    });

    expect(thread.id).toBeTruthy();
    expect(thread.article_id).toBe(article.id);
    expect(thread.slack_channel_id).toBe("C123");

    const found = await getThreadBySlack(db, "C123", "1234567890.123456");
    expect(found).not.toBeNull();
    expect(found!.id).toBe(thread.id);
    expect(found!.article.title).toBe("Thread Test");
  });

  it("getThreadBySlack returns null for unknown thread", async () => {
    const found = await getThreadBySlack(db, "C999", "0000000000.000000");
    expect(found).toBeNull();
  });

  it("updateThreadResponseId updates the openai_response_id", async () => {
    const article = await insertArticle(db, {
      slug: "update-resp-test",
      title: "Update Resp",
      description: "Desc",
      content: "Content",
    });

    const thread = await insertArticleThread(db, {
      article_id: article.id,
      slack_channel_id: "C789",
      slack_thread_ts: "9999999999.999999",
      openai_response_id: "resp_old",
    });

    await updateThreadResponseId(db, thread.id, "resp_new");

    const found = await getThreadBySlack(db, "C789", "9999999999.999999");
    expect(found!.openai_response_id).toBe("resp_new");
  });

  it("enforces unique constraint on channel + thread_ts", async () => {
    const article = await insertArticle(db, {
      slug: "unique-test",
      title: "Unique",
      description: "Desc",
      content: "Content",
    });

    await insertArticleThread(db, {
      article_id: article.id,
      slack_channel_id: "C111",
      slack_thread_ts: "1111111111.111111",
    });

    await expect(
      insertArticleThread(db, {
        article_id: article.id,
        slack_channel_id: "C111",
        slack_thread_ts: "1111111111.111111",
      }),
    ).rejects.toThrow();
  });
});
