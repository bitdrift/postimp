import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { createOrganization } from "@/lib/db/organizations";
import { createOrgToken, COOKIE_NAME, buildOrgCookieOptions } from "@/lib/org-context";
import { log, serializeError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  log.info({ operation: "api.org.create", message: "POST /api/org/create" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }
  if (name.trim().length > 100) {
    return NextResponse.json(
      { error: "Organization name must be 100 characters or less" },
      { status: 400 },
    );
  }

  const db = createDbClient();

  try {
    const org = await createOrganization(db, user.id, name.trim());

    // Auto-switch to the new org
    const token = await createOrgToken({
      orgId: org.id,
      orgName: org.name,
      role: "owner",
      userId: user.id,
    });

    log.info({
      operation: "api.org.create",
      message: "Organization created",
      orgId: org.id,
      orgName: org.name,
    });

    const response = NextResponse.json({
      success: true,
      organization: { id: org.id, name: org.name },
    });
    response.cookies.set(COOKIE_NAME, token, buildOrgCookieOptions());
    return response;
  } catch (err) {
    log.error({
      operation: "api.org.create",
      message: "Failed to create organization",
      error: serializeError(err),
    });
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
