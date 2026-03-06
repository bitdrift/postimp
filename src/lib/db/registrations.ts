import type { DbClient } from "./client";
import type { PendingRegistration } from "@/lib/supabase/types";

export type { PendingRegistration } from "@/lib/supabase/types";

export async function getValidRegistration(
  client: DbClient,
  phone: string,
): Promise<{ token: string } | null> {
  const { data, error } = await client
    .from("pending_registrations")
    .select("token")
    .eq("phone", phone)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .single();
  if (error) return null;
  return data;
}

export async function getRegistrationByToken(
  client: DbClient,
  token: string,
): Promise<PendingRegistration | null> {
  const { data, error } = await client
    .from("pending_registrations")
    .select("*")
    .eq("token", token)
    .single();
  if (error) return null;
  return data;
}

export async function getUnusedRegistrationByToken(
  client: DbClient,
  token: string,
): Promise<PendingRegistration | null> {
  const { data, error } = await client
    .from("pending_registrations")
    .select("*")
    .eq("token", token)
    .eq("used", false)
    .single();
  if (error) return null;
  return data;
}

export async function insertRegistration(
  client: DbClient,
  phone: string,
): Promise<{ token: string }> {
  const { data, error } = await client
    .from("pending_registrations")
    .insert({ phone })
    .select("token")
    .single();
  if (error) throw error;
  return data;
}

export async function markRegistrationUsed(client: DbClient, token: string): Promise<void> {
  const { error } = await client
    .from("pending_registrations")
    .update({ used: true })
    .eq("token", token);
  if (error) throw error;
}
