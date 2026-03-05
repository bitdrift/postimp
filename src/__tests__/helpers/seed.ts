import { vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliverFn } from "@/lib/core/types";

// Track seeded user IDs so cleanAll only deletes what this test suite created
const seededUserIds: string[] = [];

export async function seedProfile(
  overrides: Record<string, unknown> = {}
): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const id = crypto.randomUUID();

  // Insert into auth.users via RPC (PostgREST only exposes public schema)
  const { error: rpcError } = await supabase.rpc("test_create_user", { user_id: id });
  if (rpcError) throw new Error(`seedProfile: create user failed: ${rpcError.message || JSON.stringify(rpcError)}`);

  seededUserIds.push(id);

  // Use UUID fragment for phone uniqueness across parallel test files
  const phoneSuffix = id.replace(/-/g, "").slice(0, 10);
  const { error: profileError } = await supabase.from("profiles").insert({
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
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; preview_token: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
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

export async function seedInstagramConnection(
  profileId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("instagram_connections")
    .insert({
      profile_id: profileId,
      instagram_user_id: "ig_user_123",
      access_token: "test_access_token",
      token_expires_at: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      instagram_username: "testuser",
      ...overrides,
    })
    .select("id")
    .single();

  if (error) throw new Error(`seedInstagramConnection: ${error.message || JSON.stringify(error)}`);
  return data!;
}

/**
 * Deletes all test data created by this test suite.
 * Uses a sentinel UUID with .neq() because PostgREST requires a filter
 * on DELETE — it rejects unconditional deletes for safety.
 */
export async function cleanAll() {
  const supabase = createAdminClient();
  const NIL = "00000000-0000-0000-0000-000000000000";

  // Delete in FK dependency order
  const { error: msgErr } = await supabase.from("messages").delete().neq("id", NIL);
  if (msgErr) console.error("cleanAll messages:", msgErr.message);

  const { error: postErr } = await supabase.from("posts").delete().neq("id", NIL);
  if (postErr) console.error("cleanAll posts:", postErr.message);

  const { error: igErr } = await supabase.from("instagram_connections").delete().neq("id", NIL);
  if (igErr) console.error("cleanAll instagram_connections:", igErr.message);

  const { error: profErr } = await supabase.from("profiles").delete().neq("id", NIL);
  if (profErr) console.error("cleanAll profiles:", profErr.message);

  // Only clean auth.users we seeded, not all users globally
  for (const userId of seededUserIds) {
    await supabase.rpc("test_delete_user", { user_id: userId });
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
