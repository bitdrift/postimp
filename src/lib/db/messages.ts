import type { DbClient } from "./client";
import type { Message, MessageChannel } from "@/lib/supabase/types";

export type { Message, MessageDirection, MessageChannel } from "@/lib/supabase/types";

export async function insertMessage(
  client: DbClient,
  fields: {
    profile_id: string | null;
    direction: "inbound" | "outbound";
    body: string;
    channel: MessageChannel;
    phone?: string | null;
    media_url?: string | null;
    twilio_sid?: string | null;
    post_id?: string | null;
  },
): Promise<{ id: string }> {
  const { data, error } = await client.from("messages").insert(fields).select("id").single();
  if (error) throw error;
  return data;
}

export async function updateMessage(
  client: DbClient,
  id: string,
  fields: Partial<Pick<Message, "post_id" | "media_url">>,
): Promise<void> {
  const { error } = await client.from("messages").update(fields).eq("id", id);
  if (error) throw error;
}

export async function getMessages(
  client: DbClient,
  profileId: string,
  opts: {
    channel: MessageChannel;
    postId?: string;
    before?: string;
    limit?: number;
    ascending?: boolean;
  },
): Promise<Message[]> {
  let query = client
    .from("messages")
    .select("*")
    .eq("profile_id", profileId)
    .eq("channel", opts.channel)
    .order("created_at", { ascending: opts.ascending ?? false })
    .limit(opts.limit ?? 50);

  if (opts.postId) {
    query = query.eq("post_id", opts.postId);
  }

  if (opts.before) {
    query = query.lt("created_at", opts.before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
