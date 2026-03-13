import { describe, it, expect, afterEach } from "vitest";
import { createDbClient } from "@/lib/db/client";
import { insertProfile, getProfile, updateProfile } from "@/lib/db/profiles";
import { createOrganization, getOrganizationForUser } from "@/lib/db/organizations";
import {
  insertRegistration,
  getUnusedRegistrationByToken,
  markRegistrationUsed,
  getRegistrationByToken,
} from "@/lib/db/registrations";
import { seedAuthUser, cleanAll } from "../../helpers/seed";

const db = createDbClient();

function randomPhone(): string {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  return `+1${digits}`;
}

describe("create-profile flow (signup → profile → org)", () => {
  afterEach(async () => {
    await cleanAll();
  });

  it("creates profile and default organization for a new user", async () => {
    const userId = await seedAuthUser();

    // --- Replicate what /api/auth/create-profile does ---
    await insertProfile(db, { id: userId });
    await createOrganization(db, userId, "My Organization");

    // Verify profile
    const profile = await getProfile(db, userId);
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe(userId);
    expect(profile!.onboarding_completed).toBe(false);

    // Verify organization
    const org = await getOrganizationForUser(db, userId);
    expect(org).not.toBeNull();
    expect(org!.name).toBe("My Organization");
    expect(org!.creator_user_id).toBe(userId);
    expect(org!.caption_style).toBe("polished");
    expect(org!.publish_platforms).toEqual(["instagram"]);

    // Verify membership with owner role
    const { data: membership } = await db
      .from("organization_members")
      .select("*")
      .eq("organization_id", org!.id)
      .eq("user_id", userId)
      .single();

    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("owner");
  });

  it("creates profile with phone from SMS registration token", async () => {
    const phone = randomPhone();

    // Create a pending registration (simulates SMS verification)
    const { token } = await insertRegistration(db, phone);
    expect(token).toBeTruthy();

    const userId = await seedAuthUser();

    // --- Replicate SMS path of /api/auth/create-profile (same order as route.ts) ---
    const registration = await getUnusedRegistrationByToken(db, token);
    expect(registration).not.toBeNull();
    expect(registration!.phone).toBe(phone);

    await markRegistrationUsed(db, token);
    await insertProfile(db, { id: userId, phone: registration!.phone });
    await createOrganization(db, userId, "My Organization");

    // Verify profile has phone
    const profile = await getProfile(db, userId);
    expect(profile).not.toBeNull();
    expect(profile!.phone).toBe(phone);

    // Verify registration is marked used
    const usedReg = await getRegistrationByToken(db, token);
    expect(usedReg!.used).toBe(true);

    // Verify org still created
    const org = await getOrganizationForUser(db, userId);
    expect(org).not.toBeNull();
    expect(org!.name).toBe("My Organization");
  });

  it("rejects already-used SMS registration token", async () => {
    const phone = randomPhone();
    const { token } = await insertRegistration(db, phone);

    // Use the token once
    await markRegistrationUsed(db, token);

    // Attempting to look up the used token should return null
    const registration = await getUnusedRegistrationByToken(db, token);
    expect(registration).toBeNull();
  });

  it("rejects duplicate profile creation (race condition guard)", async () => {
    const userId = await seedAuthUser();

    await insertProfile(db, { id: userId });

    // Second insert should throw with unique violation (code 23505)
    await expect(insertProfile(db, { id: userId })).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("handles full onboarding completion after profile creation", async () => {
    const userId = await seedAuthUser();

    // Step 1: Create profile + org (signup)
    await insertProfile(db, { id: userId });
    const org = await createOrganization(db, userId, "My Organization");

    // Step 2: Complete onboarding (simulates /onboarding form submission)
    await updateProfile(db, userId, {
      brand_name: "Cool Brand",
      brand_description: "A cool brand for cool people",
      tone: "witty",
      target_audience: "millennials",
      onboarding_completed: true,
    });

    // Rename org to match brand
    const { error: orgUpdateError } = await db
      .from("organizations")
      .update({ name: "Cool Brand" })
      .eq("id", org.id);
    expect(orgUpdateError).toBeNull();

    // Verify final state
    const profile = await getProfile(db, userId);
    expect(profile!.onboarding_completed).toBe(true);
    expect(profile!.brand_name).toBe("Cool Brand");
    expect(profile!.tone).toBe("witty");

    const updatedOrg = await getOrganizationForUser(db, userId);
    expect(updatedOrg!.name).toBe("Cool Brand");
  });
});
