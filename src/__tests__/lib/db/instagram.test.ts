import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import { seedProfile, seedInstagramConnection, cleanAll } from "../../helpers/seed";
import { getInstagramConnection, upsertInstagramConnection } from "@/lib/db/instagram";

const db = createDbClient();

describe("instagram connections", () => {
  afterEach(async () => {
    await cleanAll();
  });

  describe("getInstagramConnection", () => {
    it("returns connection when it exists", async () => {
      const { id } = await seedProfile();
      await seedInstagramConnection(id);

      const connection = await getInstagramConnection(db, id);
      expect(connection).not.toBeNull();
      expect(connection!.profile_id).toBe(id);
      expect(connection!.instagram_username).toBe("testuser");
    });

    it("returns null when no connection", async () => {
      const { id } = await seedProfile();
      const connection = await getInstagramConnection(db, id);
      expect(connection).toBeNull();
    });
  });

  describe("upsertInstagramConnection", () => {
    it("inserts new connection", async () => {
      const { id } = await seedProfile();
      await upsertInstagramConnection(db, {
        profile_id: id,
        instagram_user_id: "ig_456",
        access_token: "token_abc",
        token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        instagram_username: "newuser",
      });

      const connection = await getInstagramConnection(db, id);
      expect(connection!.instagram_user_id).toBe("ig_456");
      expect(connection!.instagram_username).toBe("newuser");
    });

    it("updates existing connection on conflict", async () => {
      const { id } = await seedProfile();
      await seedInstagramConnection(id);

      await upsertInstagramConnection(db, {
        profile_id: id,
        instagram_user_id: "ig_updated",
        access_token: "new_token",
        token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        instagram_username: "updateduser",
      });

      const connection = await getInstagramConnection(db, id);
      expect(connection!.instagram_user_id).toBe("ig_updated");
    });
  });
});
