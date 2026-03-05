import { describe, it, expect, vi, afterEach } from "vitest";
import { makeWebDeliver, makeSmsDeliver } from "@/lib/core/deliver";
import { sendSms } from "@/lib/twilio/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedProfile, seedPost, cleanAll } from "../../helpers/seed";

const mockSendSms = vi.mocked(sendSms);

describe("deliver functions", () => {
  afterEach(async () => {
    await cleanAll();
    mockSendSms.mockClear();
  });

  it("makeWebDeliver inserts message with channel=web", async () => {
    const { id } = await seedProfile();
    const supabase = createAdminClient();
    const deliver = makeWebDeliver(supabase, id);

    await deliver("Hello from web");

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("profile_id", id)
      .single();

    expect(data).toBeDefined();
    expect(data!.body).toBe("Hello from web");
    expect(data!.channel).toBe("web");
    expect(data!.direction).toBe("outbound");
  });

  it("makeSmsDeliver calls sendSms AND inserts message with channel=sms", async () => {
    const { id } = await seedProfile({ phone: "+15559876543" });
    const supabase = createAdminClient();
    const deliver = makeSmsDeliver(supabase, id, "+15559876543");

    await deliver("Hello from SMS");

    expect(mockSendSms).toHaveBeenCalledWith("+15559876543", "Hello from SMS");

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("profile_id", id)
      .single();

    expect(data).toBeDefined();
    expect(data!.body).toBe("Hello from SMS");
    expect(data!.channel).toBe("sms");
    expect(data!.direction).toBe("outbound");
    expect(data!.phone).toBe("+15559876543");
  });

  it("makeWebDeliver links message to post via postId", async () => {
    const { id } = await seedProfile();
    const post = await seedPost(id);
    const supabase = createAdminClient();
    const deliver = makeWebDeliver(supabase, id);

    await deliver("Reply about your post", post.id);

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("profile_id", id)
      .single();

    expect(data).toBeDefined();
    expect(data!.post_id).toBe(post.id);
    expect(data!.body).toBe("Reply about your post");
  });
});
