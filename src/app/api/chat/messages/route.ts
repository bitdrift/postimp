import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getMessages } from "@/lib/db/messages";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");

  const db = createDbClient();

  try {
    const messages = await getMessages(db, user.id, {
      channel: "web",
      ascending: true,
      ...(before && { before }),
    });

    return NextResponse.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
