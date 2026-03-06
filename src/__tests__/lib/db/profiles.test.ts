import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import { seedProfile, cleanAll } from "../../helpers/seed";
import { getProfile, getProfileByPhone, insertProfile, updateProfile } from "@/lib/db/profiles";

const db = createDbClient();

describe("profiles", () => {
  afterEach(async () => {
    await cleanAll();
  });

  describe("getProfile", () => {
    it("returns profile when it exists", async () => {
      const { id } = await seedProfile({ brand_name: "TestBrand" });
      const profile = await getProfile(db, id);

      expect(profile).not.toBeNull();
      expect(profile!.id).toBe(id);
      expect(profile!.brand_name).toBe("TestBrand");
    });

    it("returns null for nonexistent profile", async () => {
      const profile = await getProfile(db, crypto.randomUUID());
      expect(profile).toBeNull();
    });
  });

  describe("getProfileByPhone", () => {
    it("returns {id} when phone matches", async () => {
      const { id } = await seedProfile();
      const profile = await getProfile(db, id);
      const result = await getProfileByPhone(db, profile!.phone!);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(id);
    });

    it("returns null for unknown phone", async () => {
      const result = await getProfileByPhone(db, "+19999999999");
      expect(result).toBeNull();
    });
  });

  describe("insertProfile", () => {
    it("throws on duplicate insert", async () => {
      const { id } = await seedProfile();

      await expect(insertProfile(db, { id })).rejects.toThrow();
    });
  });

  describe("updateProfile", () => {
    it("updates profile fields", async () => {
      const { id } = await seedProfile();
      await updateProfile(db, id, { brand_name: "Updated Brand" });

      const profile = await getProfile(db, id);
      expect(profile!.brand_name).toBe("Updated Brand");
    });
  });
});
