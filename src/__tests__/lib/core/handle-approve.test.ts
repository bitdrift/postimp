import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleApprove } from "@/lib/core/handle-approve";
import { publishToInstagram } from "@/lib/instagram/publish";
import { createDbClient } from "@/lib/db/client";
import type { DeliverFn } from "@/lib/core/types";
import type { Post } from "@/lib/db/posts";
import {
  seedProfile,
  seedPost,
  seedInstagramConnection,
  cleanAll,
  makeTestDeliver,
} from "../../helpers/seed";

const mockPublish = vi.mocked(publishToInstagram);

describe("handleApprove", () => {
  let deliver: DeliverFn;
  let messages: Array<{ text: string; postId?: string }>;

  beforeEach(() => {
    ({ deliver, messages } = makeTestDeliver());
    mockPublish.mockResolvedValue({ success: true, instagramPostId: "ig_123" });
  });

  afterEach(async () => {
    await cleanAll();
    mockPublish.mockReset();
  });

  async function getPost(postId: string): Promise<Post> {
    const db = createDbClient();
    const { data } = await db.from("posts").select("*").eq("id", postId).single();
    return data as Post;
  }

  it("sends noInstagram message when no connection", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id);
    const fullPost = await getPost(post.id);

    await handleApprove(id, fullPost, "web", deliver);

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text.toLowerCase()).toContain("instagram");
  });

  it("sends expired message when token expired", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id);
    const fullPost = await getPost(post.id);
    await seedInstagramConnection(id, {
      token_expires_at: new Date(Date.now() - 86400000).toISOString(),
    });

    await handleApprove(id, fullPost, "web", deliver);

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text.toLowerCase()).toContain("expired");
  });

  it("publishes successfully and updates post status", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id);
    const fullPost = await getPost(post.id);
    await seedInstagramConnection(id);

    await handleApprove(id, fullPost, "web", deliver);

    // publishStarted + publishSuccess
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(messages[1].text).toContain("live");

    // Check DB
    const updated = await getPost(post.id);
    expect(updated.status).toBe("published");
    expect(updated.instagram_post_id).toBe("ig_123");
  });

  it("delivers failure message on Instagram publish error", async () => {
    mockPublish.mockResolvedValueOnce({
      success: false,
      error: "API rate limit exceeded",
    });

    const { id } = await seedProfile();
    const post = await seedPost(id);
    const fullPost = await getPost(post.id);
    await seedInstagramConnection(id);

    await handleApprove(id, fullPost, "web", deliver);

    // publishStarted + publishFailed
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(messages[1].text).toContain("rate limit");

    // Post should still be draft
    const updated = await getPost(post.id);
    expect(updated.status).toBe("draft");
  });
});
