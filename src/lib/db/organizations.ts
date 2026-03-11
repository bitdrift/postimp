import type { DbClient } from "./client";
import type { Organization, OrganizationMember } from "@/lib/supabase/types";
import { getActiveOrgContext } from "@/lib/org-context";

export type { Organization, OrganizationMember } from "@/lib/supabase/types";

/**
 * Get the active organization for a user.
 * Reads the active_org cookie first; falls back to first membership.
 * The cookie is only available in Next.js request contexts (server components, API routes).
 */
export async function getActiveOrganization(
  client: DbClient,
  userId: string,
): Promise<Organization | null> {
  // Try the cookie first
  try {
    const ctx = await getActiveOrgContext();
    if (ctx && ctx.userId === userId) {
      const { data: org } = await client
        .from("organizations")
        .select("*")
        .eq("id", ctx.orgId)
        .single();
      if (org) return org;
    }
  } catch {
    // cookies() throws outside Next.js request context (e.g. tests, cron)
  }

  // Fall back to first membership
  return getOrganizationForUser(client, userId);
}

/**
 * Get the first organization for a user (no cookie awareness).
 * Use this in contexts without cookies (cron jobs, tests, etc).
 */
export async function getOrganizationForUser(
  client: DbClient,
  userId: string,
): Promise<Organization | null> {
  const orgs = await getOrganizationsForUser(client, userId);
  return orgs[0] ?? null;
}

/**
 * Get all organizations a user belongs to, ordered by join date.
 */
export async function getOrganizationsForUser(
  client: DbClient,
  userId: string,
): Promise<Organization[]> {
  const { data: memberships, error } = await client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error || !memberships?.length) return [];

  const orgIds = memberships.map((m) => m.organization_id);
  const { data: orgs, error: orgError } = await client
    .from("organizations")
    .select("*")
    .in("id", orgIds);
  if (orgError || !orgs) return [];

  // Preserve join-date order
  const orgMap = new Map(orgs.map((o) => [o.id, o]));
  return orgIds.map((id) => orgMap.get(id)).filter((o): o is Organization => !!o);
}
