import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import {
  TOKEN_LIFETIME_MS,
  seedProfile,
  seedOrganization,
  seedInstagramConnection,
  cleanAll,
} from "../../helpers/seed";
import {
  getInstagramConnection,
  updateInstagramToken,
  upsertInstagramConnection,
} from "@/lib/db/instagram";

const db = createDbClient();

describe("instagram connections", () => {
  afterEach(async () => {
    await cleanAll();
  });

  describe("getInstagramConnection", () => {
    it("returns connection when it exists", async () => {
      const { id } = await seedProfile();
      const org = await seedOrganization(id);
      await seedInstagramConnection(org.id);

      const connection = await getInstagramConnection(db, org.id);
      expect(connection).not.toBeNull();
      expect(connection!.organization_id).toBe(org.id);
      expect(connection!.instagram_username).toBe("testuser");
    });

    it("returns null when no connection", async () => {
      const { id } = await seedProfile();
      const org = await seedOrganization(id);
      const connection = await getInstagramConnection(db, org.id);
      expect(connection).toBeNull();
    });
  });

  describe("updateInstagramToken", () => {
    it("updates only token fields", async () => {
      const { id } = await seedProfile();
      const org = await seedOrganization(id);
      await seedInstagramConnection(org.id);

      const newExpiry = new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString();
      await updateInstagramToken(db, org.id, "refreshed_token", newExpiry);

      const connection = await getInstagramConnection(db, org.id);
      expect(connection!.access_token).toBe("refreshed_token");
      expect(new Date(connection!.token_expires_at!).getTime()).toBe(new Date(newExpiry).getTime());
      // Other fields unchanged
      expect(connection!.instagram_user_id).toBe("ig_user_123");
      expect(connection!.instagram_username).toBe("testuser");
    });
  });

  describe("upsertInstagramConnection", () => {
    it("inserts new connection", async () => {
      const { id } = await seedProfile();
      const org = await seedOrganization(id);
      await upsertInstagramConnection(db, {
        organization_id: org.id,
        instagram_user_id: "ig_456",
        access_token: "token_abc",
        token_expires_at: new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString(),
        instagram_username: "newuser",
      });

      const connection = await getInstagramConnection(db, org.id);
      expect(connection!.instagram_user_id).toBe("ig_456");
      expect(connection!.instagram_username).toBe("newuser");
    });

    it("updates existing connection on conflict", async () => {
      const { id } = await seedProfile();
      const org = await seedOrganization(id);
      await seedInstagramConnection(org.id);

      await upsertInstagramConnection(db, {
        organization_id: org.id,
        instagram_user_id: "ig_updated",
        access_token: "new_token",
        token_expires_at: new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString(),
        instagram_username: "updateduser",
      });

      const connection = await getInstagramConnection(db, org.id);
      expect(connection!.instagram_user_id).toBe("ig_updated");
    });
  });
});
