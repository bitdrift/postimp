import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { createOrgToken, COOKIE_NAME, buildOrgCookieOptions } from "@/lib/org-context";
import type { OrgRole } from "@/lib/supabase/types";
import { log } from "@/lib/logger";

export async function POST(request: NextRequest) {
  log.info({ operation: "api.org.switch", message: "POST /api/org/switch" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = await request.json();
  if (!organizationId) {
    return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
  }

  const db = createDbClient();

  // Validate membership and get org name in one query
  const { data: membership, error } = await db
    .from("organization_members")
    .select("role, organizations(id, name)")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (error || !membership) {
    log.warn({
      operation: "api.org.switch",
      message: "Non-member attempted org switch",
      orgId: organizationId,
    });
    return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
  }

  const org = membership.organizations as unknown as { id: string; name: string } | null;

  const token = await createOrgToken({
    orgId: organizationId,
    orgName: org?.name || "Organization",
    role: membership.role as OrgRole,
    userId: user.id,
  });

  log.info({
    operation: "api.org.switch",
    message: "Org switched",
    orgId: organizationId,
    orgName: org?.name,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, token, buildOrgCookieOptions());
  return response;
}
