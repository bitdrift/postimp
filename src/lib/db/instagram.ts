import type { DbClient } from "./client";
import type { InstagramConnection } from "@/lib/supabase/types";

export type { InstagramConnection } from "@/lib/supabase/types";

export async function getInstagramConnection(
  client: DbClient,
  orgId: string,
): Promise<InstagramConnection | null> {
  const { data, error } = await client
    .from("instagram_connections")
    .select("*")
    .eq("organization_id", orgId)
    .single();
  if (error) return null;
  return data;
}

export async function updateInstagramToken(
  client: DbClient,
  orgId: string,
  accessToken: string,
  tokenExpiresAt: string,
): Promise<void> {
  const { error } = await client
    .from("instagram_connections")
    .update({
      access_token: accessToken,
      token_expires_at: tokenExpiresAt,
    })
    .eq("organization_id", orgId);
  if (error) throw error;
}

export async function upsertInstagramConnection(
  client: DbClient,
  fields: {
    organization_id: string;
    user_id?: string | null;
    instagram_user_id: string;
    access_token: string;
    token_expires_at: string;
    instagram_username: string | null;
    granted_scopes?: string[] | null;
  },
): Promise<void> {
  const { error } = await client
    .from("instagram_connections")
    .upsert(fields, { onConflict: "organization_id" });
  if (error) throw error;
}
