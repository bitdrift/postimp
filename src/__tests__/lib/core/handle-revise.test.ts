import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleRevise } from "@/lib/core/handle-revise";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliverFn } from "@/lib/core/types";
import type { Post } from "@/lib/supabase/types";
import { seedProfile, seedPost, cleanAll, makeTestDeliver } from "../../helpers/seed";

describe("handleRevise", () => {
  let deliver: DeliverFn;
  let messages: Array<{ text: string; postId?: string }>;

  beforeEach(() => {
    ({ deliver, messages } = makeTestDeliver());
  });

  afterEach(async () => {
    await cleanAll();
  });

  async function getPost(postId: string): Promise<Post> {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .single();
    return data as Post;
  }

  it("generates revised caption and updates post", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id, { caption: "Original caption" });
    const fullPost = await getPost(post.id);

    await handleRevise(id, fullPost, "make it funnier", "web", deliver);

    // revisionAck + revisedCaption
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(messages[0].text.toLowerCase()).toContain("revision");

    // Caption should be updated in DB
    const updated = await getPost(post.id);
    expect(updated.caption).toBe("Test caption #test #vitest");
  });

  it("sends profileError when profile missing", async () => {
    // Construct a fake post object — no profile exists for this user,
    // so handleRevise should hit the profileError branch.
    const fakePost: Post = {
      id: crypto.randomUUID(),
      profile_id: crypto.randomUUID(),
      image_url: "https://example.com/test.jpg",
      caption: "test",
      status: "draft",
      preview_token: "abc123",
      instagram_post_id: null,
      published_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await handleRevise(fakePost.profile_id, fakePost, "feedback", "web", deliver);

    expect(deliver).toHaveBeenCalled();
    expect(messages[0].text.toLowerCase()).toContain("profile");
  });
});
