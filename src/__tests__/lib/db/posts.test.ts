import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import { seedProfile, seedPost, cleanAll } from "../../helpers/seed";
import {
  getActiveDraft,
  getPostById,
  getPostByPreviewToken,
  getPostsByProfile,
  getRecentCaptions,
  insertPost,
  updatePost,
  cancelDrafts,
} from "@/lib/db/posts";

const db = createDbClient();

describe("posts", () => {
  afterEach(async () => {
    await cleanAll();
  });

  describe("getActiveDraft", () => {
    it("returns the most recent draft", async () => {
      const { id } = await seedProfile();
      await seedPost(id, { caption: "first draft" });
      await seedPost(id, { caption: "second draft" });

      const draft = await getActiveDraft(db, id);
      expect(draft).not.toBeNull();
      expect(draft!.caption).toBe("second draft");
      expect(draft!.status).toBe("draft");
    });

    it("returns null when no drafts exist", async () => {
      const { id } = await seedProfile();
      await seedPost(id, { status: "published" });

      const draft = await getActiveDraft(db, id);
      expect(draft).toBeNull();
    });
  });

  describe("getPostById", () => {
    it("returns post when id and profileId match", async () => {
      const { id: profileId } = await seedProfile();
      const { id: postId } = await seedPost(profileId);

      const post = await getPostById(db, postId, profileId);
      expect(post).not.toBeNull();
      expect(post!.id).toBe(postId);
    });

    it("returns null when profileId does not match", async () => {
      const { id: profileId } = await seedProfile();
      const { id: postId } = await seedPost(profileId);
      const { id: otherId } = await seedProfile();

      const post = await getPostById(db, postId, otherId);
      expect(post).toBeNull();
    });

    it("returns null for nonexistent post", async () => {
      const { id: profileId } = await seedProfile();
      const post = await getPostById(db, crypto.randomUUID(), profileId);
      expect(post).toBeNull();
    });
  });

  describe("getPostByPreviewToken", () => {
    it("returns post by preview token", async () => {
      const { id: profileId } = await seedProfile();
      const { preview_token } = await seedPost(profileId);

      const post = await getPostByPreviewToken(db, preview_token);
      expect(post).not.toBeNull();
      expect(post!.preview_token).toBe(preview_token);
    });

    it("returns null for invalid token", async () => {
      const post = await getPostByPreviewToken(db, crypto.randomUUID());
      expect(post).toBeNull();
    });
  });

  describe("getPostsByProfile", () => {
    it("returns non-cancelled posts in desc order", async () => {
      const { id } = await seedProfile();
      await seedPost(id, { caption: "draft one", status: "draft" });
      await seedPost(id, { caption: "published one", status: "published" });
      await seedPost(id, { caption: "cancelled one", status: "cancelled" });

      const posts = await getPostsByProfile(db, id);
      expect(posts).toHaveLength(2);
      // Most recent first
      expect(posts[0].caption).toBe("published one");
      expect(posts[1].caption).toBe("draft one");
      // No cancelled posts
      expect(posts.every((p) => p.status !== "cancelled")).toBe(true);
    });

    it("returns empty array for user with no posts", async () => {
      const { id } = await seedProfile();
      const posts = await getPostsByProfile(db, id);
      expect(posts).toEqual([]);
    });
  });

  describe("getRecentCaptions", () => {
    it("returns captions from published posts only", async () => {
      const { id } = await seedProfile();
      await seedPost(id, { caption: "draft caption", status: "draft" });
      await seedPost(id, { caption: "published caption", status: "published" });

      const captions = await getRecentCaptions(db, id);
      expect(captions).toEqual(["published caption"]);
    });

    it("respects limit parameter", async () => {
      const { id } = await seedProfile();
      await seedPost(id, { caption: "cap1", status: "published" });
      await seedPost(id, { caption: "cap2", status: "published" });
      await seedPost(id, { caption: "cap3", status: "published" });

      const captions = await getRecentCaptions(db, id, 2);
      expect(captions).toHaveLength(2);
    });
  });

  describe("insertPost", () => {
    it("creates a post and returns id and preview_token", async () => {
      const { id: profileId } = await seedProfile();
      const result = await insertPost(db, {
        profile_id: profileId,
        image_url: "https://example.com/img.jpg",
        caption: "test caption",
        status: "draft",
      });

      expect(result.id).toBeDefined();
      expect(result.preview_token).toBeDefined();

      const post = await getPostById(db, result.id, profileId);
      expect(post!.caption).toBe("test caption");
    });
  });

  describe("updatePost", () => {
    it("updates post fields", async () => {
      const { id: profileId } = await seedProfile();
      const { id: postId } = await seedPost(profileId);

      await updatePost(db, postId, {
        caption: "updated caption",
        status: "published",
      });

      const post = await getPostById(db, postId, profileId);
      expect(post!.caption).toBe("updated caption");
      expect(post!.status).toBe("published");
    });
  });

  describe("cancelDrafts", () => {
    it("cancels all draft posts for a profile", async () => {
      const { id } = await seedProfile();
      await seedPost(id, { status: "draft" });
      await seedPost(id, { status: "draft" });
      await seedPost(id, { status: "published" });

      await cancelDrafts(db, id);

      const draft = await getActiveDraft(db, id);
      expect(draft).toBeNull();

      // Published post should be unaffected
      const posts = await getPostsByProfile(db, id);
      expect(posts).toHaveLength(1);
      expect(posts[0].status).toBe("published");
    });
  });
});
