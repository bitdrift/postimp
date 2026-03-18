import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { captureDraftFromAI, reviseArticle, buildArticleContext } from "@/lib/core/article-tools";
import { sendArticleMessage, sendArticleToolResults } from "@/lib/openai/article-writer";
import { createDbClient } from "@/lib/db/client";
import { insertArticle, getArticleById } from "@/lib/db/articles";

vi.mock("@/lib/openai/article-writer", () => ({
  sendArticleMessage: vi.fn(),
  sendArticleToolResults: vi.fn(),
}));

const mockSendMessage = vi.mocked(sendArticleMessage);
const mockSendToolResults = vi.mocked(sendArticleToolResults);

const db = createDbClient();
const NIL = "00000000-0000-0000-0000-000000000000";

const sampleFields = {
  title: "Test Title",
  slug: `test-slug-${crypto.randomUUID().slice(0, 8)}`,
  description: "Test description",
  content: "# Test\n\nContent here.",
  tags: ["test"],
  og_title: "OG Title",
  og_description: "OG Desc",
};

async function cleanArticles() {
  await db.from("marketing_article_threads").delete().neq("id", NIL);
  await db.from("marketing_articles").delete().neq("id", NIL);
}

describe("buildArticleContext", () => {
  const article = {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "test-slug",
    title: "Test Title",
    description: "Test description",
    content: "# Hello\n\nShort content.",
    author: "Post Imp Team",
    tags: ["test", "ai"],
    published: false,
    published_at: null,
    og_title: null,
    og_description: null,
    og_image_url: null,
    canonical_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("includes article fields and user feedback", () => {
    const result = buildArticleContext(article, "make it longer");

    expect(result).toContain("Title: Test Title");
    expect(result).toContain("Slug: test-slug");
    expect(result).toContain("Tags: test, ai");
    expect(result).toContain("# Hello\n\nShort content.");
    expect(result).toContain("User feedback: make it longer");
  });

  it("truncates long content", () => {
    const longArticle = { ...article, content: "x".repeat(5000) };

    const result = buildArticleContext(longArticle, "revise");

    expect(result).toContain("[content truncated]");
    expect(result).not.toContain("x".repeat(5000));
  });

  it("does not truncate short content", () => {
    const result = buildArticleContext(article, "revise");

    expect(result).not.toContain("[content truncated]");
  });
});

describe("captureDraftFromAI", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    mockSendToolResults.mockReset();
  });

  afterEach(async () => {
    await cleanArticles();
  });

  it("captures article fields from update_article tool call", async () => {
    mockSendMessage.mockResolvedValue({
      responseId: "resp_1",
      textResponse: "",
      toolCalls: [{ name: "update_article", callId: "call_1", args: sampleFields }],
    });
    mockSendToolResults.mockResolvedValue({
      responseId: "resp_2",
      textResponse: "Here's your article!",
      toolCalls: [],
    });

    const result = await captureDraftFromAI("write about testing");

    expect(result.articleFields).not.toBeNull();
    expect(result.articleFields!.title).toBe("Test Title");
    expect(result.articleFields!.slug).toBe(sampleFields.slug);
    expect(result.responseId).toBe("resp_2");
    expect(result.textResponse).toBe("Here's your article!");
  });

  it("returns null articleFields when AI produces no update_article call", async () => {
    mockSendMessage.mockResolvedValue({
      responseId: "resp_1",
      textResponse: "I can't write that.",
      toolCalls: [],
    });

    const result = await captureDraftFromAI("something vague");

    expect(result.articleFields).toBeNull();
    expect(result.textResponse).toBe("I can't write that.");
  });

  it("rejects publish_article during draft capture", async () => {
    mockSendMessage.mockResolvedValue({
      responseId: "resp_1",
      textResponse: "",
      toolCalls: [{ name: "publish_article", callId: "call_1", args: {} }],
    });
    mockSendToolResults.mockResolvedValue({
      responseId: "resp_2",
      textResponse: "Saved as draft.",
      toolCalls: [],
    });

    const result = await captureDraftFromAI("publish immediately");

    expect(result.articleFields).toBeNull();
    expect(mockSendToolResults).toHaveBeenCalledWith({
      previousResponseId: "resp_1",
      toolOutputs: [
        {
          callId: "call_1",
          output: "Article saved as draft. The user will review before publishing.",
        },
      ],
    });
  });
});

describe("reviseArticle", () => {
  let articleId: string;

  beforeEach(async () => {
    mockSendMessage.mockReset();
    mockSendToolResults.mockReset();

    const slug = `revise-test-${crypto.randomUUID().slice(0, 8)}`;
    const article = await insertArticle(db, {
      slug,
      title: "Original Title",
      description: "Original desc",
      content: "# Original",
      tags: ["original"],
    });
    articleId = article.id;
  });

  afterEach(async () => {
    await cleanArticles();
  });

  it("updates article in DB when AI calls update_article", async () => {
    const updatedFields = { ...sampleFields, title: "Revised Title" };
    mockSendMessage.mockResolvedValue({
      responseId: "resp_1",
      textResponse: "",
      toolCalls: [{ name: "update_article", callId: "call_1", args: updatedFields }],
    });
    mockSendToolResults.mockResolvedValue({
      responseId: "resp_2",
      textResponse: "Updated!",
      toolCalls: [],
    });

    const result = await reviseArticle(db, articleId, "make it better", null);

    expect(result.published).toBe(false);
    expect(result.updatedFields).not.toBeNull();
    expect(result.updatedFields!.title).toBe("Revised Title");
    expect(result.textResponse).toBe("Updated!");

    // Verify DB was updated
    const article = await getArticleById(db, articleId);
    expect(article!.title).toBe("Revised Title");
  });

  it("publishes article when AI calls publish_article", async () => {
    mockSendMessage.mockResolvedValue({
      responseId: "resp_1",
      textResponse: "",
      toolCalls: [{ name: "publish_article", callId: "call_1", args: {} }],
    });
    mockSendToolResults.mockResolvedValue({
      responseId: "resp_2",
      textResponse: "Published!",
      toolCalls: [],
    });

    const result = await reviseArticle(db, articleId, "publish it", null);

    expect(result.published).toBe(true);

    const article = await getArticleById(db, articleId);
    expect(article).not.toBeNull();
    expect(article!.published).toBe(true);
    expect(article!.published_at).toBeTruthy();
  });

  it("calls onUpdate callback when update_article is executed", async () => {
    const updatedFields = { ...sampleFields, title: "Callback Title" };
    mockSendMessage.mockResolvedValue({
      responseId: "resp_1",
      textResponse: "",
      toolCalls: [{ name: "update_article", callId: "call_1", args: updatedFields }],
    });
    mockSendToolResults.mockResolvedValue({
      responseId: "resp_2",
      textResponse: "Done",
      toolCalls: [],
    });

    const onUpdate = vi.fn();
    await reviseArticle(db, articleId, "revise", null, { onUpdate });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ title: "Callback Title" }));
  });

  it("calls onPublish callback with slug when publish_article is executed", async () => {
    mockSendMessage.mockResolvedValue({
      responseId: "resp_1",
      textResponse: "",
      toolCalls: [{ name: "publish_article", callId: "call_1", args: {} }],
    });
    mockSendToolResults.mockResolvedValue({
      responseId: "resp_2",
      textResponse: "Live!",
      toolCalls: [],
    });

    const onPublish = vi.fn();
    await reviseArticle(db, articleId, "ship it", null, { onPublish });

    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublish).toHaveBeenCalledWith(expect.stringContaining("revise-test-"));
  });

  it("passes previousResponseId to sendArticleMessage", async () => {
    mockSendMessage.mockResolvedValue({
      responseId: "resp_new",
      textResponse: "Got it",
      toolCalls: [],
    });

    await reviseArticle(db, articleId, "feedback", "resp_prev");

    expect(mockSendMessage).toHaveBeenCalledWith({
      text: "feedback",
      previousResponseId: "resp_prev",
    });
  });

  it("throws when AI message fails", async () => {
    mockSendMessage.mockRejectedValue(new Error("OpenAI down"));

    await expect(reviseArticle(db, articleId, "revise", null)).rejects.toThrow("OpenAI down");
  });
});
