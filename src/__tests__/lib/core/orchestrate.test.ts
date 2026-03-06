import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { orchestrate } from "@/lib/core/orchestrate";
import { sendMessage, sendToolResults } from "@/lib/openai/conversation";
import { publishToInstagram } from "@/lib/instagram/publish";
import { isTokenExpiringSoon } from "@/lib/instagram/auth";
import type { MessageContext } from "@/lib/core/types";
import { createDbClient } from "@/lib/db/client";
import {
  seedProfile,
  seedPost,
  seedInstagramConnection,
  cleanAll,
  makeTestDeliver,
} from "../../helpers/seed";

const mockSendMessage = vi.mocked(sendMessage);
const mockSendToolResults = vi.mocked(sendToolResults);
const mockPublish = vi.mocked(publishToInstagram);
const mockIsExpiring = vi.mocked(isTokenExpiringSoon);

describe("orchestrate", () => {
  let deliver: ReturnType<typeof makeTestDeliver>["deliver"];
  let messages: ReturnType<typeof makeTestDeliver>["messages"];

  beforeEach(() => {
    ({ deliver, messages } = makeTestDeliver());
    mockSendMessage.mockResolvedValue({
      responseId: "resp_1",
      textResponse: "Here's a caption!",
      toolCalls: [
        { name: "update_caption", callId: "call_1", args: { caption: "AI generated caption" } },
      ],
    });
    mockSendToolResults.mockResolvedValue({
      responseId: "resp_2",
      textResponse: "How does that look?",
      toolCalls: [],
    });
    mockPublish.mockResolvedValue({ success: true, instagramPostId: "ig_123" });
  });

  afterEach(async () => {
    await cleanAll();
    mockSendMessage.mockReset();
    mockSendToolResults.mockReset();
    mockPublish.mockReset();
    mockIsExpiring.mockReset();
    mockIsExpiring.mockReturnValue(false);
  });

  function ctx(profileId: string, overrides: Partial<MessageContext> = {}): MessageContext {
    return { profileId, body: "", mediaUrl: null, channel: "web", ...overrides };
  }

  it("guards against incomplete onboarding", async () => {
    const { id } = await seedProfile({ onboarding_completed: false });
    await orchestrate(ctx(id, { body: "hello" }), deliver);

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text).toContain("onboarding");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("prompts for photo when no draft and no media", async () => {
    const { id } = await seedProfile();
    await orchestrate(ctx(id, { body: "hello" }), deliver);

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text).toContain("photo");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("handles update_caption tool call", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id);

    await orchestrate(ctx(id, { body: "write me a caption" }), deliver);

    // Should deliver: caption message + AI text
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(messages[0].text).toContain("CAPTION_START");
    expect(messages[0].text).toContain("AI generated caption");
    expect(messages[1].text).toBe("How does that look?");

    // Caption should be updated in DB
    const db = createDbClient();
    const { data } = await db.from("posts").select("caption").eq("id", post.id).single();
    expect(data?.caption).toBe("AI generated caption");
  });

  it("handles publish_post tool call", async () => {
    const { id } = await seedProfile();
    await seedPost(id);
    await seedInstagramConnection(id);

    mockSendMessage.mockResolvedValueOnce({
      responseId: "resp_pub_1",
      textResponse: "",
      toolCalls: [{ name: "publish_post", callId: "call_pub", args: {} }],
    });
    mockSendToolResults.mockResolvedValueOnce({
      responseId: "resp_pub_2",
      textResponse: "Your post is live on Instagram!",
      toolCalls: [],
    });

    await orchestrate(ctx(id, { body: "publish it" }), deliver);

    expect(mockPublish).toHaveBeenCalledOnce();
    expect(messages[messages.length - 1].text).toContain("live");
  });

  it("handles AI text-only response (no tool calls)", async () => {
    const { id } = await seedProfile();
    await seedPost(id);

    mockSendMessage.mockResolvedValueOnce({
      responseId: "resp_q",
      textResponse: "Your caption is 50 characters, which is a good length!",
      toolCalls: [],
    });

    await orchestrate(ctx(id, { body: "is my caption too long?" }), deliver);

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text).toContain("50 characters");
    expect(mockSendToolResults).not.toHaveBeenCalled();
  });

  it("passes previous_response_id for conversation continuity", async () => {
    const { id } = await seedProfile();
    await seedPost(id, { openai_conversation_id: "resp_previous" });

    mockSendMessage.mockResolvedValueOnce({
      responseId: "resp_new",
      textResponse: "Sure, here it is revised!",
      toolCalls: [],
    });

    await orchestrate(ctx(id, { body: "make it shorter" }), deliver);

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ previousResponseId: "resp_previous" }),
    );
  });

  it("creates post from media and sends to AI in one flow", async () => {
    const { id } = await seedProfile();
    const buffer = new ArrayBuffer(8);

    const result = await orchestrate(
      ctx(id, { body: "sunset photo", imageBuffer: buffer, contentType: "image/jpeg" }),
      deliver,
    );

    expect(result.postId).toBeDefined();
    expect(mockSendMessage).toHaveBeenCalledOnce();
    // imageUrl should be passed to AI for new posts
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: expect.any(String) }),
    );
  });

  it("targets specific post when postId is provided", async () => {
    const { id } = await seedProfile();
    const post1 = await seedPost(id, { caption: "First post" });
    const post2 = await seedPost(id, { caption: "Second post" });

    mockSendMessage.mockResolvedValueOnce({
      responseId: "resp_specific",
      textResponse: "Updated!",
      toolCalls: [],
    });

    // Target post1 specifically, even though post2 is newer
    await orchestrate(ctx(id, { body: "revise this", postId: post1.id }), deliver);

    expect(mockSendMessage).toHaveBeenCalledOnce();
    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].postId).toBe(post1.id);
  });

  it("handles AI error gracefully", async () => {
    const { id } = await seedProfile();
    await seedPost(id);

    mockSendMessage.mockRejectedValueOnce(new Error("API error"));

    await orchestrate(ctx(id, { body: "hello" }), deliver);

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text.toLowerCase()).toContain("wrong");
  });
});
