import { vi } from "vitest";
import { createDbClient } from "@/lib/db/client";
import type { DeliverFn } from "@/lib/core/types";

/** 60-day token lifetime used by Instagram long-lived tokens */
export const TOKEN_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;

// Track seeded user IDs so cleanAll only deletes what this test suite created
const seededUserIds: string[] = [];

export async function seedProfile(
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const db = createDbClient();
  const id = crypto.randomUUID();

  // Insert into auth.users via RPC (PostgREST only exposes public schema)
  const { error: rpcError } = await db.rpc("test_create_user", { user_id: id });
  if (rpcError)
    throw new Error(
      `seedProfile: create user failed: ${rpcError.message || JSON.stringify(rpcError)}`,
    );

  seededUserIds.push(id);

  // Use UUID fragment for phone uniqueness across parallel test files
  const phoneSuffix = id.replace(/-/g, "").slice(0, 10);
  const { error: profileError } = await db.from("profiles").insert({
    id,
    phone: `+1${phoneSuffix}`,
    brand_name: "Test Brand",
    brand_description: "A test brand",
    tone: "friendly",
    target_audience: "testers",
    onboarding_completed: true,
    ...overrides,
  });
  if (profileError)
    throw new Error(`seedProfile: ${profileError.message || JSON.stringify(profileError)}`);

  return { id };
}

export async function seedPost(
  profileId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; preview_token: string }> {
  const db = createDbClient();
  const { data, error } = await db
    .from("posts")
    .insert({
      profile_id: profileId,
      image_url: "https://example.com/test.jpg",
      caption: "Default test caption",
      status: "draft",
      ...overrides,
    })
    .select("id, preview_token")
    .single();

  if (error) throw new Error(`seedPost: ${error.message || JSON.stringify(error)}`);
  return data!;
}

export async function seedOrganization(
  userId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const db = createDbClient();
  const { data, error } = await db
    .from("organizations")
    .insert({
      name: "Test Organization",
      creator_user_id: userId,
      ...overrides,
    })
    .select("id")
    .single();

  if (error) throw new Error(`seedOrganization: ${error.message || JSON.stringify(error)}`);

  const { error: memberError } = await db.from("organization_members").insert({
    organization_id: data!.id,
    user_id: userId,
    role: "owner",
  });
  if (memberError)
    throw new Error(
      `seedOrganization membership: ${memberError.message || JSON.stringify(memberError)}`,
    );

  return data!;
}

export async function seedInstagramConnection(
  orgId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const db = createDbClient();
  const { data, error } = await db
    .from("instagram_connections")
    .insert({
      organization_id: orgId,
      instagram_user_id: "ig_user_123",
      access_token: "test_access_token",
      token_expires_at: new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString(),
      instagram_username: "testuser",
      ...overrides,
    })
    .select("id")
    .single();

  if (error) throw new Error(`seedInstagramConnection: ${error.message || JSON.stringify(error)}`);
  return data!;
}

export async function seedFacebookConnection(
  orgId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const db = createDbClient();
  const { data, error } = await db
    .from("facebook_connections")
    .insert({
      organization_id: orgId,
      facebook_user_id: "fb_user_123",
      facebook_page_id: "fb_page_123",
      page_name: "Test Page",
      page_access_token: "test_page_token",
      ...overrides,
    })
    .select("id")
    .single();

  if (error) throw new Error(`seedFacebookConnection: ${error.message || JSON.stringify(error)}`);
  return data!;
}

/**
 * Deletes all test data created by this test suite.
 * Uses a sentinel UUID with .neq() because PostgREST requires a filter
 * on DELETE — it rejects unconditional deletes for safety.
 */
export async function cleanAll() {
  const db = createDbClient();
  const NIL = "00000000-0000-0000-0000-000000000000";

  // Delete in FK dependency order
  const { error: msgErr } = await db.from("messages").delete().neq("id", NIL);
  if (msgErr) console.error("cleanAll messages:", msgErr.message);

  const { error: postErr } = await db.from("posts").delete().neq("id", NIL);
  if (postErr) console.error("cleanAll posts:", postErr.message);

  const { error: igErr } = await db.from("instagram_connections").delete().neq("id", NIL);
  if (igErr) console.error("cleanAll instagram_connections:", igErr.message);

  const { error: fbErr } = await db.from("facebook_connections").delete().neq("id", NIL);
  if (fbErr) console.error("cleanAll facebook_connections:", fbErr.message);

  const { error: pendingFbErr } = await db.from("pending_facebook_tokens").delete().neq("id", NIL);
  if (pendingFbErr) console.error("cleanAll pending_facebook_tokens:", pendingFbErr.message);

  const { error: pendingRegErr } = await db.from("pending_registrations").delete().neq("id", NIL);
  if (pendingRegErr) console.error("cleanAll pending_registrations:", pendingRegErr.message);

  const { error: memberErr } = await db.from("organization_members").delete().neq("id", NIL);
  if (memberErr) console.error("cleanAll organization_members:", memberErr.message);

  const { error: orgErr } = await db.from("organizations").delete().neq("id", NIL);
  if (orgErr) console.error("cleanAll organizations:", orgErr.message);

  const { error: profErr } = await db.from("profiles").delete().neq("id", NIL);
  if (profErr) console.error("cleanAll profiles:", profErr.message);

  // Only clean auth.users we seeded, not all users globally
  for (const userId of seededUserIds) {
    await db.rpc("test_delete_user", { user_id: userId });
  }
  seededUserIds.length = 0;
}

/**
 * Shared test helper — creates a mock DeliverFn that captures messages.
 */
export function makeTestDeliver(): {
  deliver: DeliverFn;
  messages: Array<{ text: string; postId?: string }>;
} {
  const messages: Array<{ text: string; postId?: string }> = [];
  const deliver = vi.fn(async (text: string, postId?: string) => {
    messages.push({ text, postId });
  });
  return { deliver, messages };
}
