import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import { seedProfile, seedFacebookConnection, cleanAll } from "../../helpers/seed";
import { getFacebookConnection, upsertFacebookConnection } from "@/lib/db/facebook";

const db = createDbClient();

describe("facebook connections", () => {
  afterEach(async () => {
    await cleanAll();
  });

  describe("getFacebookConnection", () => {
    it("returns connection when it exists", async () => {
      const { id } = await seedProfile();
      await seedFacebookConnection(id);

      const connection = await getFacebookConnection(db, id);
      expect(connection).not.toBeNull();
      expect(connection!.profile_id).toBe(id);
      expect(connection!.page_name).toBe("Test Page");
    });

    it("returns null when no connection", async () => {
      const { id } = await seedProfile();
      const connection = await getFacebookConnection(db, id);
      expect(connection).toBeNull();
    });
  });

  describe("upsertFacebookConnection", () => {
    it("inserts new connection", async () => {
      const { id } = await seedProfile();
      await upsertFacebookConnection(db, {
        profile_id: id,
        facebook_user_id: "fb_456",
        facebook_page_id: "page_456",
        page_name: "New Page",
        page_access_token: "token_abc",
      });

      const connection = await getFacebookConnection(db, id);
      expect(connection!.facebook_user_id).toBe("fb_456");
      expect(connection!.page_name).toBe("New Page");
    });

    it("updates existing connection on conflict", async () => {
      const { id } = await seedProfile();
      await seedFacebookConnection(id);

      await upsertFacebookConnection(db, {
        profile_id: id,
        facebook_user_id: "fb_updated",
        facebook_page_id: "page_updated",
        page_name: "Updated Page",
        page_access_token: "new_token",
      });

      const connection = await getFacebookConnection(db, id);
      expect(connection!.facebook_user_id).toBe("fb_updated");
      expect(connection!.page_name).toBe("Updated Page");
    });
  });
});
