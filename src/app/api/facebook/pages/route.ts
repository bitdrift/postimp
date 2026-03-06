import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getPendingFacebookToken } from "@/lib/db/facebook";
import { listPages } from "@/lib/facebook/auth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createDbClient();
  const pending = await getPendingFacebookToken(db, user.id);

  if (!pending) {
    return NextResponse.json({ error: "No pending Facebook token found" }, { status: 404 });
  }

  try {
    const pages = await listPages(pending.user_access_token);
    return NextResponse.json({ pages });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
