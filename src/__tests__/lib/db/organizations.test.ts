import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import { seedProfile, cleanAll } from "../../helpers/seed";
import {
  createOrganization,
  getOrganizationForUser,
  getOrganizationsForUser,
} from "@/lib/db/organizations";

const db = createDbClient();

describe("organizations", () => {
  afterEach(async () => {
    await cleanAll();
  });

  describe("createOrganization", () => {
    it("creates org and adds user as owner", async () => {
      const { id } = await seedProfile();
      const org = await createOrganization(db, id, "Test Org");

      expect(org.name).toBe("Test Org");
      expect(org.creator_user_id).toBe(id);

      // Verify membership was created
      const { data: membership } = await db
        .from("organization_members")
        .select("*")
        .eq("organization_id", org.id)
        .eq("user_id", id)
        .single();

      expect(membership).not.toBeNull();
      expect(membership!.role).toBe("owner");
    });

    it("allows creating multiple orgs for same user", async () => {
      const { id } = await seedProfile();
      const org1 = await createOrganization(db, id, "Org One");
      const org2 = await createOrganization(db, id, "Org Two");

      expect(org1.id).not.toBe(org2.id);
      expect(org1.name).toBe("Org One");
      expect(org2.name).toBe("Org Two");

      const orgs = await getOrganizationsForUser(db, id);
      expect(orgs).toHaveLength(2);
    });

    it("sets default values for optional fields", async () => {
      const { id } = await seedProfile();
      const org = await createOrganization(db, id, "Defaults Org");

      expect(org.caption_style).toBe("polished");
      expect(org.publish_platforms).toEqual(["instagram"]);
      expect(org.brand_name).toBeNull();
    });
  });

  describe("getOrganizationForUser", () => {
    it("returns the first org when user has one", async () => {
      const { id } = await seedProfile();
      const created = await createOrganization(db, id, "Solo Org");

      const org = await getOrganizationForUser(db, id);
      expect(org).not.toBeNull();
      expect(org!.id).toBe(created.id);
      expect(org!.name).toBe("Solo Org");
    });

    it("returns the earliest-joined org when user has multiple", async () => {
      const { id } = await seedProfile();
      const first = await createOrganization(db, id, "First Org");
      await createOrganization(db, id, "Second Org");

      const org = await getOrganizationForUser(db, id);
      expect(org!.id).toBe(first.id);
    });

    it("returns null when user has no orgs", async () => {
      const { id } = await seedProfile();
      const org = await getOrganizationForUser(db, id);
      expect(org).toBeNull();
    });
  });

  describe("getOrganizationsForUser", () => {
    it("returns empty array for user with no orgs", async () => {
      const { id } = await seedProfile();
      const orgs = await getOrganizationsForUser(db, id);
      expect(orgs).toEqual([]);
    });

    it("returns all orgs in join-date order", async () => {
      const { id } = await seedProfile();
      const org1 = await createOrganization(db, id, "Alpha");
      const org2 = await createOrganization(db, id, "Beta");
      const org3 = await createOrganization(db, id, "Gamma");

      const orgs = await getOrganizationsForUser(db, id);
      expect(orgs).toHaveLength(3);
      expect(orgs[0].id).toBe(org1.id);
      expect(orgs[1].id).toBe(org2.id);
      expect(orgs[2].id).toBe(org3.id);
    });

    it("only returns orgs the user is a member of", async () => {
      const user1 = await seedProfile();
      const user2 = await seedProfile();

      await createOrganization(db, user1.id, "User1 Org");
      await createOrganization(db, user2.id, "User2 Org");

      const user1Orgs = await getOrganizationsForUser(db, user1.id);
      expect(user1Orgs).toHaveLength(1);
      expect(user1Orgs[0].name).toBe("User1 Org");

      const user2Orgs = await getOrganizationsForUser(db, user2.id);
      expect(user2Orgs).toHaveLength(1);
      expect(user2Orgs[0].name).toBe("User2 Org");
    });

    it("includes orgs where user is added as member (not creator)", async () => {
      const owner = await seedProfile();
      const member = await seedProfile();

      const org = await createOrganization(db, owner.id, "Shared Org");

      // Manually add second user as member
      await db.from("organization_members").insert({
        organization_id: org.id,
        user_id: member.id,
        role: "member",
      });

      const memberOrgs = await getOrganizationsForUser(db, member.id);
      expect(memberOrgs).toHaveLength(1);
      expect(memberOrgs[0].id).toBe(org.id);
      expect(memberOrgs[0].name).toBe("Shared Org");
    });
  });
});
