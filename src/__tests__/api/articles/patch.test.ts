import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/articles/[id]/route";
import { createDbClient } from "@/lib/db/client";
import { insertArticle, getArticleById } from "@/lib/db/articles";

const db = createDbClient();
const NIL = "00000000-0000-0000-0000-000000000000";

async function seedDraft(overrides: Record<string, unknown> = {}) {
  return insertArticle(db, {
    slug: `patch-test-${crypto.randomUUID().slice(0, 8)}`,
    title: "Patch Test",
    description: "Test description",
    content: "# Original content",
    tags: ["test"],
    published: false,
    ...overrides,
  });
}

async function cleanAll() {
  await db.from("marketing_articles").delete().neq("id", NIL);
}

function makePatchRequest(id: string, body: unknown) {
  const req = new NextRequest(`http://localhost:3000/api/articles/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const params = Promise.resolve({ id });
  return PATCH(req, { params });
}

describe("PATCH /api/articles/[id]", () => {
  afterEach(async () => {
    await cleanAll();
  });

  it("updates draft article content", async () => {
    const article = await seedDraft();
    const res = await makePatchRequest(article.id, { content: "# Updated content" });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.article.content).toBe("# Updated content");

    const fromDb = await getArticleById(db, article.id);
    expect(fromDb!.content).toBe("# Updated content");
  });

  it("returns 404 for non-existent article", async () => {
    const res = await makePatchRequest(NIL, { content: "test" });

    expect(res.status).toBe(404);
  });

  it("returns 400 when content is missing", async () => {
    const article = await seedDraft();
    const res = await makePatchRequest(article.id, {});

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/content is required/);
  });

  it("returns 400 for published articles", async () => {
    const article = await seedDraft({
      published: true,
      published_at: new Date().toISOString(),
    });
    const res = await makePatchRequest(article.id, { content: "nope" });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/published/i);
  });

  it("returns 400 when content exceeds max length", async () => {
    const article = await seedDraft();
    const longContent = "x".repeat(50_001);
    const res = await makePatchRequest(article.id, { content: longContent });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/too long/i);
  });

  it("returns 400 for invalid JSON", async () => {
    const article = await seedDraft();
    const req = new NextRequest(`http://localhost:3000/api/articles/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: article.id }) });

    expect(res.status).toBe(400);
  });

  it("preserves other fields when updating content", async () => {
    const article = await seedDraft({ title: "Keep This Title", tags: ["keep"] });
    await makePatchRequest(article.id, { content: "# New content" });

    const fromDb = await getArticleById(db, article.id);
    expect(fromDb!.title).toBe("Keep This Title");
    expect(fromDb!.tags).toEqual(["keep"]);
    expect(fromDb!.content).toBe("# New content");
  });
});
