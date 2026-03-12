import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import { cleanAll } from "../../helpers/seed";
import {
  getValidRegistration,
  getRegistrationByToken,
  getUnusedRegistrationByToken,
  insertRegistration,
  markRegistrationUsed,
} from "@/lib/db/registrations";

const db = createDbClient();

describe("pending registrations", () => {
  afterEach(async () => {
    await cleanAll();
  });

  describe("insertRegistration / getRegistrationByToken", () => {
    it("creates and retrieves a registration", async () => {
      const { token } = await insertRegistration(db, "+15550001111");

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const reg = await getRegistrationByToken(db, token);
      expect(reg).not.toBeNull();
      expect(reg!.phone).toBe("+15550001111");
      expect(reg!.used).toBe(false);
    });
  });

  describe("getUnusedRegistrationByToken", () => {
    it("returns registration when unused", async () => {
      const { token } = await insertRegistration(db, "+15550005555");
      const reg = await getUnusedRegistrationByToken(db, token);

      expect(reg).not.toBeNull();
      expect(reg!.phone).toBe("+15550005555");
    });

    it("returns null when registration is used", async () => {
      const { token } = await insertRegistration(db, "+15550006666");
      await markRegistrationUsed(db, token);

      const reg = await getUnusedRegistrationByToken(db, token);
      expect(reg).toBeNull();
    });

    it("returns null for nonexistent token", async () => {
      const reg = await getUnusedRegistrationByToken(db, crypto.randomUUID());
      expect(reg).toBeNull();
    });
  });

  describe("getValidRegistration", () => {
    it("returns token for valid, unused, non-expired registration", async () => {
      const { token } = await insertRegistration(db, "+15550002222");
      const result = await getValidRegistration(db, "+15550002222");

      expect(result).not.toBeNull();
      expect(result!.token).toBe(token);
    });

    it("returns null for used registration", async () => {
      const { token } = await insertRegistration(db, "+15550003333");
      await markRegistrationUsed(db, token);

      const result = await getValidRegistration(db, "+15550003333");
      expect(result).toBeNull();
    });

    it("returns null for unknown phone", async () => {
      const result = await getValidRegistration(db, "+19999999998");
      expect(result).toBeNull();
    });
  });

  describe("markRegistrationUsed", () => {
    it("marks a registration as used", async () => {
      const { token } = await insertRegistration(db, "+15550004444");
      await markRegistrationUsed(db, token);

      const reg = await getRegistrationByToken(db, token);
      expect(reg!.used).toBe(true);
    });
  });
});
