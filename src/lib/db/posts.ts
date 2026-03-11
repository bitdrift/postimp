import type { DbClient } from "./client";
import type { Post } from "@/lib/supabase/types";

export type { Post, PostStatus } from "@/lib/supabase/types";

export async function getActiveDraft(client: DbClient, profileId: string): Promise<Post | null> {
  const { data, error } = await client
    .from("posts")
    .select("*")
    .eq("profile_id", profileId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

export async function getPostById(
  client: DbClient,
  postId: string,
  options: { profileId?: string; organizationId?: string },
): Promise<Post | null> {
  let query = client.from("posts").select("*").eq("id", postId);
  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }
  if (options.profileId) {
    query = query.eq("profile_id", options.profileId);
  }
  const { data, error } = await query.single();
  if (error) return null;
  return data;
}

export async function getPostByPreviewToken(client: DbClient, token: string): Promise<Post | null> {
  const { data, error } = await client
    .from("posts")
    .select("*")
    .eq("preview_token", token)
    .single();
  if (error) return null;
  return data;
}

export async function getPostsByOrganization(
  client: DbClient,
  organizationId: string,
  profileId?: string,
): Promise<Post[]> {
  let query = client
    .from("posts")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (profileId) {
    query = query.eq("profile_id", profileId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getRecentCaptions(
  client: DbClient,
  profileId: string,
  limit: number = 5,
): Promise<string[]> {
  const { data } = await client
    .from("posts")
    .select("caption")
    .eq("profile_id", profileId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).map((p) => p.caption).filter(Boolean) as string[];
}

export async function insertPost(
  client: DbClient,
  fields: {
    profile_id: string;
    organization_id?: string | null;
    image_url: string;
    caption: string;
    status: string;
  },
): Promise<{ id: string; preview_token: string }> {
  const { data, error } = await client
    .from("posts")
    .insert(fields)
    .select("id, preview_token")
    .single();
  if (error) throw error;
  return data;
}

export async function updatePost(
  client: DbClient,
  postId: string,
  fields: Partial<Omit<Post, "id" | "profile_id" | "created_at" | "updated_at" | "preview_token">>,
): Promise<void> {
  const { error } = await client.from("posts").update(fields).eq("id", postId);
  if (error) throw error;
}

export async function cancelDrafts(
  client: DbClient,
  profileId: string,
  organizationId?: string,
): Promise<void> {
  let query = client
    .from("posts")
    .update({ status: "cancelled" })
    .eq("profile_id", profileId)
    .eq("status", "draft");
  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }
  const { error } = await query;
  if (error) throw error;
}
