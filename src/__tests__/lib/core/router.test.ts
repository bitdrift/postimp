import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { routeMessage } from "@/lib/core/router";
import type { MessageContext } from "@/lib/core/types";
import { seedProfile, seedPost, cleanAll, makeTestDeliver } from "../../helpers/seed";
import { createAdminClient } from "@/lib/supabase/admin";

describe("routeMessage", () => {
  let deliver: ReturnType<typeof makeTestDeliver>["deliver"];
  let messages: ReturnType<typeof makeTestDeliver>["messages"];

  beforeEach(() => {
    ({ deliver, messages } = makeTestDeliver());
  });

  afterEach(async () => {
    await cleanAll();
  });

  function ctx(
    profileId: string,
    overrides: Partial<MessageContext> = {}
  ): MessageContext {
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
  });

  it("sends help message on HELP keyword", async () => {
    const { id } = await seedProfile();
    await routeMessage(ctx(id, { body: "help" }), deliver);

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text).toContain("Help");
  });

  it("sends no-draft prompt when no media and no active draft", async () => {
    const { id } = await seedProfile();
    await routeMessage(ctx(id, { body: "random text" }), deliver);

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text).toContain("photo");
  });

  it("cancels draft on CANCEL keyword", async () => {
    const { id } = await seedProfile();
    await seedPost(id);
    await routeMessage(ctx(id, { body: "cancel" }), deliver);

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text.toLowerCase()).toContain("cancel");

    // Verify post status changed in DB
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("posts")
      .select("status")
      .eq("profile_id", id)
      .single();
    expect(data?.status).toBe("cancelled");
  });

  it("dispatches to handleApprove on approval keywords", async () => {
    const { id } = await seedProfile();
    await seedPost(id);

    // handleApprove will check for instagram connection — no connection = noInstagram msg
    await routeMessage(ctx(id, { body: "approve" }), deliver);

    expect(deliver).toHaveBeenCalled();
    // Without IG connection, we get the "connect instagram" message
    expect(messages[0].text.toLowerCase()).toContain("instagram");
  });

  it("dispatches to handleRevise for freeform text with active draft", async () => {
    const { id } = await seedProfile();
    await seedPost(id);
    await routeMessage(
      ctx(id, { body: "make it more casual" }),
      deliver
    );

    // handleRevise sends revisionAck then revisedCaption
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(messages[0].text.toLowerCase()).toContain("revision");
  });

  it("dispatches to handleNewPost when media buffer is present", async () => {
    const { id } = await seedProfile();
    const buffer = new ArrayBuffer(8);
    const result = await routeMessage(
      ctx(id, {
        body: "my new post",
        imageBuffer: buffer,
        contentType: "image/jpeg",
      }),
      deliver
    );

    expect(result.postId).toBeDefined();
    expect(deliver).toHaveBeenCalled();
  });

  it("handles SMS SET CAPTION: command", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id);
    await routeMessage(
      ctx(id, {
        body: "SET CAPTION: My custom caption here",
        channel: "sms",
      }),
      deliver
    );

    expect(deliver).toHaveBeenCalledOnce();
    expect(messages[0].text).toContain("updated");

    // Verify caption was updated in DB
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("posts")
      .select("caption")
      .eq("id", post.id)
      .single();
    expect(data?.caption).toBe("My custom caption here");
  });
});
