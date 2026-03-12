import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import { seedProfile, seedPost, cleanAll } from "../../helpers/seed";
import { insertMessage, updateMessage, getMessages } from "@/lib/db/messages";

const db = createDbClient();

describe("messages", () => {
  afterEach(async () => {
    await cleanAll();
  });

  describe("insertMessage", () => {
    it("inserts a message and returns its id", async () => {
      const { id: profileId } = await seedProfile();
      const result = await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "hello",
        channel: "web",
      });

      expect(result.id).toBeDefined();
    });

    it("inserts a message with optional fields", async () => {
      const { id: profileId } = await seedProfile();
      const { id: postId } = await seedPost(profileId);

      const result = await insertMessage(db, {
        profile_id: profileId,
        direction: "outbound",
        body: "reply",
        channel: "sms",
        phone: "+15551234567",
        post_id: postId,
      });

      expect(result.id).toBeDefined();

      const messages = await getMessages(db, profileId, { channel: "sms" });
      expect(messages[0].phone).toBe("+15551234567");
      expect(messages[0].post_id).toBe(postId);
    });
  });

  describe("updateMessage", () => {
    it("updates post_id on a message", async () => {
      const { id: profileId } = await seedProfile();
      const { id: postId } = await seedPost(profileId);

      const msg = await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "test",
        channel: "web",
      });

      await updateMessage(db, msg.id, { post_id: postId });

      const messages = await getMessages(db, profileId, { channel: "web" });
      const updated = messages.find((m) => m.id === msg.id);
      expect(updated!.post_id).toBe(postId);
    });
  });

  describe("getMessages", () => {
    it("returns messages filtered by channel", async () => {
      const { id: profileId } = await seedProfile();
      await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "web msg",
        channel: "web",
      });
      await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "sms msg",
        channel: "sms",
      });

      const webMessages = await getMessages(db, profileId, { channel: "web" });
      expect(webMessages).toHaveLength(1);
      expect(webMessages[0].body).toBe("web msg");
    });

    it("filters by postId", async () => {
      const { id: profileId } = await seedProfile();
      const { id: postId } = await seedPost(profileId);

      await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "with post",
        channel: "web",
        post_id: postId,
      });
      await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "without post",
        channel: "web",
      });

      const messages = await getMessages(db, profileId, {
        channel: "web",
        postId,
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe("with post");
    });

    it("respects limit", async () => {
      const { id: profileId } = await seedProfile();
      for (let i = 0; i < 5; i++) {
        await insertMessage(db, {
          profile_id: profileId,
          direction: "inbound",
          body: `msg ${i}`,
          channel: "web",
        });
      }

      const messages = await getMessages(db, profileId, {
        channel: "web",
        limit: 3,
      });
      expect(messages).toHaveLength(3);
    });

    it("returns messages in descending order by default", async () => {
      const { id: profileId } = await seedProfile();
      await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "first",
        channel: "web",
      });
      await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "second",
        channel: "web",
      });

      const messages = await getMessages(db, profileId, { channel: "web" });
      expect(messages[0].body).toBe("second");
      expect(messages[1].body).toBe("first");
    });

    it("returns messages in ascending order when requested", async () => {
      const { id: profileId } = await seedProfile();
      await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "first",
        channel: "web",
      });
      await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "second",
        channel: "web",
      });

      const messages = await getMessages(db, profileId, {
        channel: "web",
        ascending: true,
      });
      expect(messages[0].body).toBe("first");
      expect(messages[1].body).toBe("second");
    });

    it("filters messages with before cursor", async () => {
      const { id: profileId } = await seedProfile();
      await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "old msg",
        channel: "web",
      });

      const recent = await insertMessage(db, {
        profile_id: profileId,
        direction: "inbound",
        body: "new msg",
        channel: "web",
      });

      // Get the timestamp of the recent message to use as cursor
      const allMessages = await getMessages(db, profileId, { channel: "web" });
      const recentMsg = allMessages.find((m) => m.id === recent.id)!;

      const older = await getMessages(db, profileId, {
        channel: "web",
        before: recentMsg.created_at,
      });
      expect(older).toHaveLength(1);
      expect(older[0].body).toBe("old msg");
    });
  });
});
