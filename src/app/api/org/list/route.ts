import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { log, serializeError } from "@/lib/logger";

export async function GET() {
  log.info({ operation: "api.org.list", message: "GET /api/org/list" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createDbClient();
  const { data: memberships, error } = await db
    .from("organization_members")
    .select("organization_id, role, organizations(id, name)")
    .eq("user_id", user.id);

  if (error) {
    log.error({
      operation: "api.org.list",
      message: "Failed to fetch organizations",
      error: serializeError(error),
    });
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
  }

  const orgs = (memberships || [])
    .filter((m) => m.organizations != null)
    .map((m) => {
      const org = m.organizations as unknown as { id: string; name: string };
      return { id: org.id, name: org.name, role: m.role };
    });

  return NextResponse.json({ organizations: orgs });
}
