import type { DbClient } from "./client";
import type { Profile } from "@/lib/supabase/types";

export type { Profile } from "@/lib/supabase/types";

export async function getProfile(client: DbClient, id: string): Promise<Profile | null> {
  const { data, error } = await client.from("profiles").select("*").eq("id", id).single();
  if (error) return null;
  return data;
}

export async function getProfileByPhone(
  client: DbClient,
  phone: string,
): Promise<{ id: string } | null> {
  const { data, error } = await client.from("profiles").select("id").eq("phone", phone).single();
  if (error) return null;
  return data;
}

export async function insertProfile(
  client: DbClient,
  fields: { id: string; phone?: string | null },
): Promise<void> {
  const { error } = await client.from("profiles").insert(fields);
  if (error) throw error;
}

export async function updateProfile(
  client: DbClient,
  id: string,
  fields: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>,
): Promise<void> {
  const { error } = await client.from("profiles").update(fields).eq("id", id);
  if (error) throw error;
}
