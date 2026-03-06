import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@/lib/supabase/admin";

export type DbClient = SupabaseClient;

export function createDbClient(): DbClient {
  return createAdminClient();
}
