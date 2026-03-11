import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import { seedProfile, seedPost, seedOrganization, cleanAll } from "../../helpers/seed";
import {
  getActiveDraft,
  getPostById,
  getPostByPreviewToken,
  getPostsByOrganization,
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

      const post = await getPostById(db, postId, { profileId });
      expect(post).not.toBeNull();
      expect(post!.id).toBe(postId);
    });

    it("returns post when id and organizationId match", async () => {
      const { id: profileId } = await seedProfile();
      const { id: orgId } = await seedOrganization(profileId);
      const { id: postId } = await seedPost(profileId, { organization_id: orgId });

      // Another user in the same org can look up by orgId
      const post = await getPostById(db, postId, { organizationId: orgId });
      expect(post).not.toBeNull();
      expect(post!.id).toBe(postId);
    });

    it("returns null when profileId does not match", async () => {
      const { id: profileId } = await seedProfile();
      const { id: postId } = await seedPost(profileId);
      const { id: otherId } = await seedProfile();

      const post = await getPostById(db, postId, { profileId: otherId });
      expect(post).toBeNull();
    });

    it("returns null when organizationId does not match", async () => {
      const { id: profileId } = await seedProfile();
      const { id: orgId } = await seedOrganization(profileId);
      const { id: otherOrgId } = await seedOrganization(profileId, { name: "Other Org" });
      const { id: postId } = await seedPost(profileId, { organization_id: orgId });

      const post = await getPostById(db, postId, { organizationId: otherOrgId });
      expect(post).toBeNull();
    });

    it("returns null for nonexistent post", async () => {
      const { id: profileId } = await seedProfile();
      const post = await getPostById(db, crypto.randomUUID(), { profileId });
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

  describe("getPostsByOrganization", () => {
    it("returns non-cancelled posts in desc order", async () => {
      const { id } = await seedProfile();
      const { id: orgId } = await seedOrganization(id);
      await seedPost(id, { caption: "draft one", status: "draft", organization_id: orgId });
      await seedPost(id, { caption: "published one", status: "published", organization_id: orgId });
      await seedPost(id, { caption: "cancelled one", status: "cancelled", organization_id: orgId });

      const posts = await getPostsByOrganization(db, orgId);
      expect(posts).toHaveLength(2);
      // Most recent first
      expect(posts[0].caption).toBe("published one");
      expect(posts[1].caption).toBe("draft one");
      // No cancelled posts
      expect(posts.every((p) => p.status !== "cancelled")).toBe(true);
    });

    it("returns empty array for org with no posts", async () => {
      const { id } = await seedProfile();
      const { id: orgId } = await seedOrganization(id);
      const posts = await getPostsByOrganization(db, orgId);
      expect(posts).toEqual([]);
    });

    it("filters by profileId when provided", async () => {
      const { id: user1 } = await seedProfile();
      const { id: user2 } = await seedProfile();
      const { id: orgId } = await seedOrganization(user1);
      await seedPost(user1, { caption: "user1 post", organization_id: orgId });
      await seedPost(user2, { caption: "user2 post", organization_id: orgId });

      const myPosts = await getPostsByOrganization(db, orgId, user1);
      expect(myPosts).toHaveLength(1);
      expect(myPosts[0].caption).toBe("user1 post");

      const allPosts = await getPostsByOrganization(db, orgId);
      expect(allPosts).toHaveLength(2);
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

      const post = await getPostById(db, result.id, { profileId });
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

      const post = await getPostById(db, postId, { profileId });
      expect(post!.caption).toBe("updated caption");
      expect(post!.status).toBe("published");
    });
  });

  describe("cancelDrafts", () => {
    it("cancels all draft posts for a profile in an org", async () => {
      const { id } = await seedProfile();
      const { id: orgId } = await seedOrganization(id);
      await seedPost(id, { status: "draft", organization_id: orgId });
      await seedPost(id, { status: "draft", organization_id: orgId });
      await seedPost(id, { status: "published", organization_id: orgId });

      await cancelDrafts(db, id, orgId);

      const draft = await getActiveDraft(db, id);
      expect(draft).toBeNull();

      // Published post should be unaffected
      const posts = await getPostsByOrganization(db, orgId);
      expect(posts).toHaveLength(1);
      expect(posts[0].status).toBe("published");
    });

    it("only cancels drafts in the specified org", async () => {
      const { id } = await seedProfile();
      const { id: org1 } = await seedOrganization(id, { name: "Org 1" });
      const { id: org2 } = await seedOrganization(id, { name: "Org 2" });
      await seedPost(id, { status: "draft", organization_id: org1 });
      await seedPost(id, { status: "draft", organization_id: org2 });

      await cancelDrafts(db, id, org1);

      const org1Posts = await getPostsByOrganization(db, org1);
      expect(org1Posts).toHaveLength(0);

      // Org2 draft should be untouched
      const org2Posts = await getPostsByOrganization(db, org2);
      expect(org2Posts).toHaveLength(1);
      expect(org2Posts[0].status).toBe("draft");
    });
  });
});
