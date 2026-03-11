import type { DbClient } from "./client";
import type { FacebookConnection } from "@/lib/supabase/types";

export type { FacebookConnection } from "@/lib/supabase/types";

export async function getFacebookConnection(
  client: DbClient,
  orgId: string,
): Promise<FacebookConnection | null> {
  const { data, error } = await client
    .from("facebook_connections")
    .select("*")
    .eq("organization_id", orgId)
    .single();
  if (error) return null;
  return data;
}

export async function upsertFacebookConnection(
  client: DbClient,
  fields: {
    organization_id: string;
    connected_by_user_id?: string | null;
    facebook_user_id: string;
    facebook_page_id: string;
    page_name: string | null;
    page_access_token: string;
    granted_scopes?: string[] | null;
  },
): Promise<void> {
  const { error } = await client
    .from("facebook_connections")
    .upsert(fields, { onConflict: "organization_id" });
  if (error) throw error;
}

export async function savePendingFacebookToken(
  client: DbClient,
  orgId: string,
  facebookUserId: string,
  userAccessToken: string,
  grantedScopes?: string[],
): Promise<void> {
  const { error } = await client.from("pending_facebook_tokens").upsert(
    {
      organization_id: orgId,
      facebook_user_id: facebookUserId,
      user_access_token: userAccessToken,
      granted_scopes: grantedScopes || null,
    },
    { onConflict: "organization_id" },
  );
  if (error) throw error;
}

export async function getPendingFacebookToken(
  client: DbClient,
  orgId: string,
): Promise<{
  facebook_user_id: string;
  user_access_token: string;
  granted_scopes: string[] | null;
} | null> {
  const { data, error } = await client
    .from("pending_facebook_tokens")
    .select("facebook_user_id, user_access_token, granted_scopes")
    .eq("organization_id", orgId)
    .single();
  if (error) return null;
  return data;
}

export async function deletePendingFacebookToken(client: DbClient, orgId: string): Promise<void> {
  const { error } = await client
    .from("pending_facebook_tokens")
    .delete()
    .eq("organization_id", orgId);
  if (error) throw error;
}
