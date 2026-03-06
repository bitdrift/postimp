import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executePublish } from "@/lib/core/handle-approve";
import { publishToInstagram } from "@/lib/instagram/publish";
import { isTokenExpiringSoon, refreshInstagramToken } from "@/lib/instagram/auth";
import { createDbClient } from "@/lib/db/client";
import { getInstagramConnection } from "@/lib/db/instagram";
import type { Post } from "@/lib/db/posts";
import { seedProfile, seedPost, seedInstagramConnection, cleanAll } from "../../helpers/seed";

const mockPublish = vi.mocked(publishToInstagram);
const mockIsExpiring = vi.mocked(isTokenExpiringSoon);
const mockRefresh = vi.mocked(refreshInstagramToken);

describe("executePublish", () => {
  beforeEach(() => {
    mockPublish.mockResolvedValue({ success: true, instagramPostId: "ig_123" });
  });

  afterEach(async () => {
    await cleanAll();
    mockPublish.mockReset();
    mockIsExpiring.mockReset();
    mockRefresh.mockReset();
    mockIsExpiring.mockReturnValue(false);
    mockRefresh.mockResolvedValue({
      accessToken: "refreshed_tok",
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    });
  });

  async function getPost(postId: string): Promise<Post> {
    const db = createDbClient();
    const { data } = await db.from("posts").select("*").eq("id", postId).single();
    return data as Post;
  }

  it("returns error when no Instagram connection", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id);
    const fullPost = await getPost(post.id);

    const result = await executePublish(id, fullPost);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Instagram");
  });

  it("returns error when token expired", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id);
    const fullPost = await getPost(post.id);
    await seedInstagramConnection(id, {
      token_expires_at: new Date(Date.now() - 86400000).toISOString(),
    });

    const result = await executePublish(id, fullPost);

    expect(result.success).toBe(false);
    expect(result.error).toContain("expired");
  });

  it("publishes successfully and updates post status", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id);
    const fullPost = await getPost(post.id);
    await seedInstagramConnection(id);

    const result = await executePublish(id, fullPost);

    expect(result.success).toBe(true);
    expect(result.instagramPostId).toBe("ig_123");

    const updated = await getPost(post.id);
    expect(updated.status).toBe("published");
    expect(updated.instagram_post_id).toBe("ig_123");
  });

  it("returns failure on Instagram publish error", async () => {
    mockPublish.mockResolvedValueOnce({
      success: false,
      error: "API rate limit exceeded",
    });

    const { id } = await seedProfile();
    const post = await seedPost(id);
    const fullPost = await getPost(post.id);
    await seedInstagramConnection(id);

    const result = await executePublish(id, fullPost);

    expect(result.success).toBe(false);
    expect(result.error).toContain("rate limit");

    const updated = await getPost(post.id);
    expect(updated.status).toBe("draft");
  });

  it("refreshes token after publish when expiring soon", async () => {
    mockIsExpiring.mockReturnValue(true);

    const { id } = await seedProfile();
    const post = await seedPost(id);
    const fullPost = await getPost(post.id);
    await seedInstagramConnection(id);

    await executePublish(id, fullPost);

    expect(mockRefresh).toHaveBeenCalledWith("test_access_token");

    const db = createDbClient();
    const connection = await getInstagramConnection(db, id);
    expect(connection!.access_token).toBe("refreshed_tok");
  });

  it("still succeeds when opportunistic refresh fails", async () => {
    mockIsExpiring.mockReturnValue(true);
    mockRefresh.mockRejectedValueOnce(new Error("refresh failed"));

    const { id } = await seedProfile();
    const post = await seedPost(id);
    const fullPost = await getPost(post.id);
    await seedInstagramConnection(id);

    const result = await executePublish(id, fullPost);

    expect(result.success).toBe(true);
    const updated = await getPost(post.id);
    expect(updated.status).toBe("published");
  });
});
