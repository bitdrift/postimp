import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleNewPost } from "@/lib/core/handle-new-post";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliverFn } from "@/lib/core/types";
import { seedProfile, cleanAll, makeTestDeliver } from "../../helpers/seed";

describe("handleNewPost", () => {
  let deliver: DeliverFn;
  let messages: Array<{ text: string; postId?: string }>;

  beforeEach(() => {
    ({ deliver, messages } = makeTestDeliver());
  });

  afterEach(async () => {
    await cleanAll();
  });

  it("creates draft with generated caption", async () => {
    const { id } = await seedProfile();
    const buffer = new ArrayBuffer(8);

    const postId = await handleNewPost(id, "my cool photo", "web", deliver, {
      kind: "buffer",
      imageBuffer: buffer,
      contentType: "image/jpeg",
    });

    expect(postId).toBeDefined();
    expect(deliver).toHaveBeenCalled();

    // Verify post in DB
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId!)
      .single();
    expect(data?.status).toBe("draft");
    expect(data?.caption).toBe("Test caption #test #vitest");
  });

  it("handles missing profile", async () => {
    const fakeId = crypto.randomUUID();

    // Create auth user but no profile
    const supabase = createAdminClient();
    await supabase.rpc("test_create_user", { user_id: fakeId });

    const buffer = new ArrayBuffer(8);
    const postId = await handleNewPost(fakeId, "photo", "web", deliver, {
      kind: "buffer",
      imageBuffer: buffer,
      contentType: "image/jpeg",
    });

    expect(postId).toBeNull();
    expect(deliver).toHaveBeenCalled();
    expect(messages[0].text.toLowerCase()).toContain("profile");
  });

  it("handles image download failure from URL source", async () => {
    const { id } = await seedProfile();

    // URL source with unreachable host — fetch will throw
    const postId = await handleNewPost(id, "photo", "web", deliver, {
      kind: "url",
      mediaUrl: "http://localhost:99999/nonexistent.jpg",
    });

    expect(postId).toBeNull();
    expect(deliver).toHaveBeenCalled();
  });

  it("handles storage upload error gracefully", async () => {
    const { id } = await seedProfile();

    // Temporarily override the storage mock to return an error
    const supabase = createAdminClient();
    const originalUpload = supabase.storage.from("post-images").upload;
    const mockUpload = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Bucket not found", statusCode: 400 },
    });

    // Patch the storage client prototype so handleNewPost's own client sees it
    const StorageFileApi = Object.getPrototypeOf(supabase.storage.from("post-images"));
    const origProtoUpload = StorageFileApi.upload;
    StorageFileApi.upload = mockUpload;

    try {
      const buffer = new ArrayBuffer(8);
      const postId = await handleNewPost(id, "photo", "web", deliver, {
        kind: "buffer",
        imageBuffer: buffer,
        contentType: "image/jpeg",
      });

      expect(postId).toBeNull();
      expect(deliver).toHaveBeenCalled();
      expect(messages[0].text.toLowerCase()).toContain("upload");
    } finally {
      StorageFileApi.upload = origProtoUpload;
    }
  });
});
