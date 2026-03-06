import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadAndCreatePost } from "@/lib/core/handle-new-post";
import { createDbClient } from "@/lib/db/client";
import type { DeliverFn } from "@/lib/core/types";
import { seedProfile, cleanAll, makeTestDeliver } from "../../helpers/seed";

describe("uploadAndCreatePost", () => {
  let deliver: DeliverFn;
  let messages: Array<{ text: string; postId?: string }>;

  beforeEach(() => {
    ({ deliver, messages } = makeTestDeliver());
  });

  afterEach(async () => {
    await cleanAll();
  });

  it("creates draft post with image", async () => {
    const { id } = await seedProfile();
    const buffer = new ArrayBuffer(8);

    const result = await uploadAndCreatePost(
      id,
      { kind: "buffer", imageBuffer: buffer, contentType: "image/jpeg" },
      "web",
      deliver,
    );

    expect(result).not.toBeNull();
    expect(result!.postId).toBeDefined();
    expect(result!.imageUrl).toBeDefined();
    expect(result!.previewToken).toBeDefined();

    // Verify post in DB with empty caption (orchestrator fills it via AI)
    const db = createDbClient();
    const { data } = await db.from("posts").select("*").eq("id", result!.postId).single();
    expect(data?.status).toBe("draft");
    expect(data?.caption).toBe("");
  });

  it("handles image download failure from URL source", async () => {
    const { id } = await seedProfile();

    const result = await uploadAndCreatePost(
      id,
      { kind: "url", mediaUrl: "http://localhost:99999/nonexistent.jpg" },
      "web",
      deliver,
    );

    expect(result).toBeNull();
    expect(deliver).toHaveBeenCalled();
  });

  it("handles storage upload error gracefully", async () => {
    const { id } = await seedProfile();

    const db = createDbClient();
    const StorageFileApi = Object.getPrototypeOf(db.storage.from("post-images"));
    const origProtoUpload = StorageFileApi.upload;
    StorageFileApi.upload = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Bucket not found", statusCode: 400 },
    });

    try {
      const buffer = new ArrayBuffer(8);
      const result = await uploadAndCreatePost(
        id,
        { kind: "buffer", imageBuffer: buffer, contentType: "image/jpeg" },
        "web",
        deliver,
      );

      expect(result).toBeNull();
      expect(deliver).toHaveBeenCalled();
      expect(messages[0].text.toLowerCase()).toContain("upload");
    } finally {
      StorageFileApi.upload = origProtoUpload;
    }
  });
});
