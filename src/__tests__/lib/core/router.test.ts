import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { routeMessage } from "@/lib/core/router";
import { sendMessage, sendToolResults } from "@/lib/openai/conversation";
import type { MessageContext } from "@/lib/core/types";
import { seedProfile, seedPost, cleanAll, makeTestDeliver } from "../../helpers/seed";
import { createDbClient } from "@/lib/db/client";

const mockSendMessage = vi.mocked(sendMessage);
const mockSendToolResults = vi.mocked(sendToolResults);

describe("routeMessage", () => {
  let deliver: ReturnType<typeof makeTestDeliver>["deliver"];
  let messages: ReturnType<typeof makeTestDeliver>["messages"];

  beforeEach(() => {
    ({ deliver, messages } = makeTestDeliver());
    // Default: AI returns update_caption tool call
    mockSendMessage.mockResolvedValue({
      responseId: "resp_test_123",
      textResponse: "Here's a caption for your post!",
      toolCalls: [
        {
          name: "update_caption",
          callId: "call_test_1",
          args: { caption: "Test caption #test #vitest" },
        },
      ],
    });
    mockSendToolResults.mockResolvedValue({
      responseId: "resp_test_456",
      textResponse: "Caption updated!",
      toolCalls: [],
    });
  });

  afterEach(async () => {
    await cleanAll();
    mockSendMessage.mockReset();
    mockSendToolResults.mockReset();
  });

  function ctx(profileId: string, overrides: Partial<MessageContext> = {}): MessageContext {
    return {
      profileId,
      body: "",
      mediaUrl: null,
      channel: "web",
      ...overrides,
    };
  }

  it("sends onboarding prompt when profile not onboarded", async () => {
    const { id } = await seedProfile({ onboarding_completed: false });
    await routeMessage(ctx(id, { body: "hello" }), deliver);

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text).toContain("onboarding");
    // AI should NOT be called
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("sends no-draft prompt when no media and no active draft", async () => {
    const { id } = await seedProfile();
    await routeMessage(ctx(id, { body: "random text" }), deliver);

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text).toContain("photo");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("creates post and calls AI when media buffer is present", async () => {
    const { id } = await seedProfile();
    const buffer = new ArrayBuffer(8);
    const result = await routeMessage(
      ctx(id, {
        body: "my new post",
        imageBuffer: buffer,
        contentType: "image/jpeg",
      }),
      deliver,
    );

    expect(result.postId).toBeDefined();
    expect(mockSendMessage).toHaveBeenCalledOnce();
    // Should deliver caption message + AI text response
    expect(deliver).toHaveBeenCalled();
  });

  it("sends message to AI with existing draft", async () => {
    const { id } = await seedProfile();
    await seedPost(id);

    // AI returns just text, no tool calls (e.g. answering a question)
    mockSendMessage.mockResolvedValueOnce({
      responseId: "resp_question",
      textResponse: "The caption looks great as-is!",
      toolCalls: [],
    });

    await routeMessage(ctx(id, { body: "is this caption too long?" }), deliver);

    expect(mockSendMessage).toHaveBeenCalledOnce();
    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text).toContain("looks great");
  });

  it("handles update_caption tool call from AI", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id);

    await routeMessage(ctx(id, { body: "make it more casual" }), deliver);

    // Should have delivered caption message and AI follow-up
    expect(mockSendMessage).toHaveBeenCalledOnce();
    expect(mockSendToolResults).toHaveBeenCalledOnce();

    // Verify caption was updated in DB
    const db = createDbClient();
    const { data } = await db.from("posts").select("caption").eq("id", post.id).single();
    expect(data?.caption).toBe("Test caption #test #vitest");
  });

  it("keeps existing draft when new media is sent", async () => {
    const { id } = await seedProfile();
    const oldPost = await seedPost(id);

    const buffer = new ArrayBuffer(8);
    await routeMessage(
      ctx(id, {
        body: "new photo",
        imageBuffer: buffer,
        contentType: "image/jpeg",
      }),
      deliver,
    );

    // Old post should still be a draft
    const db = createDbClient();
    const { data } = await db.from("posts").select("status").eq("id", oldPost.id).single();
    expect(data?.status).toBe("draft");
  });

  it("saves conversation ID on post after first AI call", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id);

    await routeMessage(ctx(id, { body: "hello" }), deliver);

    const db = createDbClient();
    const { data } = await db
      .from("posts")
      .select("openai_conversation_id")
      .eq("id", post.id)
      .single();
    expect(data?.openai_conversation_id).toBeDefined();
  });
});
