import type { DbClient } from "./client";
import type { InstagramConnection } from "@/lib/supabase/types";

export type { InstagramConnection } from "@/lib/supabase/types";

export async function getInstagramConnection(
  client: DbClient,
  profileId: string,
): Promise<InstagramConnection | null> {
  const { data, error } = await client
    .from("instagram_connections")
    .select("*")
    .eq("profile_id", profileId)
    .single();
  if (error) return null;
  return data;
}

export async function updateInstagramToken(
  client: DbClient,
  profileId: string,
  accessToken: string,
  tokenExpiresAt: string,
): Promise<void> {
  const { error } = await client
    .from("instagram_connections")
    .update({
      access_token: accessToken,
      token_expires_at: tokenExpiresAt,
    })
    .eq("profile_id", profileId);
  if (error) throw error;
}

export async function upsertInstagramConnection(
  client: DbClient,
  fields: {
    profile_id: string;
    instagram_user_id: string;
    access_token: string;
    token_expires_at: string;
    instagram_username: string | null;
  },
): Promise<void> {
  const { error } = await client
    .from("instagram_connections")
    .upsert(fields, { onConflict: "profile_id" });
  if (error) throw error;
}
