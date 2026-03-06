import type { DbClient } from "./client";
import type { FacebookConnection } from "@/lib/supabase/types";

export type { FacebookConnection } from "@/lib/supabase/types";

export async function getFacebookConnection(
  client: DbClient,
  profileId: string,
): Promise<FacebookConnection | null> {
  const { data, error } = await client
    .from("facebook_connections")
    .select("*")
    .eq("profile_id", profileId)
    .single();
  if (error) return null;
  return data;
}

export async function upsertFacebookConnection(
  client: DbClient,
  fields: {
    profile_id: string;
    facebook_user_id: string;
    facebook_page_id: string;
    page_name: string | null;
    page_access_token: string;
  },
): Promise<void> {
  const { error } = await client
    .from("facebook_connections")
    .upsert(fields, { onConflict: "profile_id" });
  if (error) throw error;
}

export async function savePendingFacebookToken(
  client: DbClient,
  profileId: string,
  facebookUserId: string,
  userAccessToken: string,
): Promise<void> {
  const { error } = await client.from("pending_facebook_tokens").upsert(
    {
      profile_id: profileId,
      facebook_user_id: facebookUserId,
      user_access_token: userAccessToken,
    },
    { onConflict: "profile_id" },
  );
  if (error) throw error;
}

export async function getPendingFacebookToken(
  client: DbClient,
  profileId: string,
): Promise<{ facebook_user_id: string; user_access_token: string } | null> {
  const { data, error } = await client
    .from("pending_facebook_tokens")
    .select("facebook_user_id, user_access_token")
    .eq("profile_id", profileId)
    .single();
  if (error) return null;
  return data;
}

export async function deletePendingFacebookToken(
  client: DbClient,
  profileId: string,
): Promise<void> {
  const { error } = await client
    .from("pending_facebook_tokens")
    .delete()
    .eq("profile_id", profileId);
  if (error) throw error;
}
